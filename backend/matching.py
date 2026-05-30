"""Source-agnostic fuzzy matching of external chart tracks against the local
Rekordbox library. Shared by the Spotify Compare and the Top 100 features so
the matching behaviour stays identical."""
import re

import numpy as np
from rapidfuzz import fuzz, process

MATCH_THRESHOLD = 85
UNCERTAIN_THRESHOLD = 70

# Words that indicate DJ-specific qualifiers / version tags. When one of these
# appears inside parens or brackets, we treat the whole tag as a strip-able
# qualifier rather than part of the song identity.
_QUALIFIER_WORDS = (
    "remaster|version|edit|mix|radio|extended|club|original|mono|stereo|live|"
    "intro|outro|instrumental|acapella|clean|dirty|dub|hh|bootleg|flip|"
    "transition|short|long|loop|vip"
)

_NORMALIZE_PATTERNS = [
    re.compile(r"\s*[\(\[]?\s*(?:feat|featuring|ft)\.?\s+[^)\]]+[\)\]]?", re.IGNORECASE),
    re.compile(
        rf"\s*[\(\[][^)\]]*(?:{_QUALIFIER_WORDS})[^)\]]*[\)\]]",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\s*-\s*(?:{_QUALIFIER_WORDS}).*$",
        re.IGNORECASE,
    ),
]


def normalize(s: str) -> str:
    if not s:
        return ""
    s = s.lower()
    for pat in _NORMALIZE_PATTERNS:
        s = pat.sub("", s)
    s = re.sub(r"[^\w\s']", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def match_tracks(chart_tracks: list, local_tracks: list) -> dict:
    """Fuzzy-match a list of external tracks against the local library.

    Each chart track is a dict with at least "title" and "artist".
    Returns {"results": [{"track": <chart_track>, "match": <match|None>}, ...],
             "summary": {"total", "match", "uncertain", "missing"}}.
    """
    valid_local = [t for t in local_tracks if (t.get("artist") or t.get("title"))]

    results: list = []
    counts = {"match": 0, "uncertain": 0, "missing": 0}

    if not valid_local or not chart_tracks:
        for track in chart_tracks:
            counts["missing"] += 1
            results.append({"track": track, "match": None})
        return {"results": results, "summary": {"total": len(chart_tracks), **counts}}

    local_artists = [normalize(t["artist"]) for t in valid_local]
    local_titles = [normalize(t["title"]) for t in valid_local]
    chart_artists = [normalize(t["artist"]) for t in chart_tracks]
    chart_titles = [normalize(t["title"]) for t in chart_tracks]

    # Score artist and title separately; a track must match well on BOTH.
    # token_set_ratio (order- and length-insensitive) handles featured artists
    # appearing on one side but not the other: chart sources list collaborators
    # inline ("Drake, Future & Molly Santana") while the library may credit only
    # the primary artist or move features into the title. The strict title score
    # in the min-combine below guards against this being too loose.
    artist_m = process.cdist(
        chart_artists, local_artists,
        scorer=fuzz.token_set_ratio, dtype=np.uint8,
    )
    # Use token_set_ratio for titles so a chart title can match a library title
    # that contains extra qualifier words (e.g. "Touch" matches "Touch (HH Clean
    # Intro)"). Artist still uses sort_ratio to avoid loose matches on shared
    # common words.
    title_m = process.cdist(
        chart_titles, local_titles,
        scorer=fuzz.token_set_ratio, dtype=np.uint8,
    )
    combined = np.minimum(artist_m, title_m)
    best_idx = combined.argmax(axis=1)
    best_scores = combined.max(axis=1)

    for i, track in enumerate(chart_tracks):
        score = int(best_scores[i])
        if score >= MATCH_THRESHOLD:
            status = "match"
        elif score >= UNCERTAIN_THRESHOLD:
            status = "uncertain"
        else:
            status = "missing"

        match = None
        if status != "missing":
            local = valid_local[int(best_idx[i])]
            match = {
                "local_track": local,
                "score": score,
                "artist_score": int(artist_m[i, best_idx[i]]),
                "title_score": int(title_m[i, best_idx[i]]),
                "status": status,
            }
        counts[status] += 1
        results.append({"track": track, "match": match})

    return {"results": results, "summary": {"total": len(chart_tracks), **counts}}
