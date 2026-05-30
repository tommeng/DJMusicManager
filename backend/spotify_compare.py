import os
import re
from typing import Optional

import numpy as np
import spotipy
from spotipy.oauth2 import SpotifyOAuth, CacheFileHandler
from rapidfuzz import fuzz, process

MATCH_THRESHOLD = 85
UNCERTAIN_THRESHOLD = 70

REDIRECT_URI = "http://127.0.0.1:8000/callback"
SCOPES = "playlist-read-private playlist-read-collaborative"
TOKEN_CACHE = ".spotify_token"

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


def extract_playlist_id(url_or_uri: str) -> str:
    m = re.search(r"(?:playlist[:/])([a-zA-Z0-9]+)", url_or_uri)
    if not m:
        raise ValueError(f"Could not extract a Spotify playlist ID from: {url_or_uri}")
    return m.group(1)


class SpotifyCompare:
    def __init__(self):
        client_id = os.environ.get("SPOTIFY_CLIENT_ID")
        client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
        if not client_id or not client_secret:
            self.auth_manager = None
            return
        self.auth_manager = SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=REDIRECT_URI,
            scope=SCOPES,
            cache_handler=CacheFileHandler(cache_path=TOKEN_CACHE),
            open_browser=False,
        )

    @property
    def configured(self) -> bool:
        return self.auth_manager is not None

    @property
    def authenticated(self) -> bool:
        if not self.auth_manager:
            return False
        return self.auth_manager.cache_handler.get_cached_token() is not None

    def _client(self) -> spotipy.Spotify:
        return spotipy.Spotify(auth_manager=self.auth_manager, requests_timeout=15)

    def get_auth_url(self) -> str:
        return self.auth_manager.get_authorize_url()

    def handle_callback(self, code: str):
        self.auth_manager.get_access_token(code, as_dict=False, check_cache=False)

    def fetch_playlist(self, playlist_url: str) -> dict:
        sp = self._client()
        playlist_id = extract_playlist_id(playlist_url)

        meta = sp.playlist(playlist_id)

        tracks: list = []
        # Spotify's API now returns tracks under the "item" key (was "track").
        # Don't filter fields — let spotipy give us the full response and we pick what we need.
        results = sp.playlist_items(playlist_id, limit=100, additional_types=("track",))
        while results:
            for item in results.get("items", []):
                t = item.get("item") or item.get("track")
                if not t or not t.get("id"):
                    continue
                tracks.append({
                    "id": t["id"],
                    "title": t.get("name", ""),
                    "artist": ", ".join(a["name"] for a in t.get("artists") or []),
                    "album": (t.get("album") or {}).get("name", ""),
                    "duration_ms": t.get("duration_ms"),
                    "url": (t.get("external_urls") or {}).get("spotify", ""),
                })
            results = sp.next(results) if results.get("next") else None

        return {
            "id": meta["id"],
            "name": meta["name"],
            "owner": (meta.get("owner") or {}).get("display_name", ""),
            "tracks": tracks,
        }

    def compare(self, playlist_url: str, local_tracks: list) -> dict:
        if not self.authenticated:
            raise RuntimeError(
                "Spotify not authenticated. Click 'Connect Spotify' on the Compare page."
            )

        playlist = self.fetch_playlist(playlist_url)
        sp_tracks = playlist["tracks"]

        valid_local = [t for t in local_tracks if (t.get("artist") or t.get("title"))]

        results: list = []
        counts = {"match": 0, "uncertain": 0, "missing": 0}

        if not valid_local or not sp_tracks:
            for sp_track in sp_tracks:
                counts["missing"] += 1
                results.append({"spotify": sp_track, "match": None})
        else:
            local_artists = [normalize(t["artist"]) for t in valid_local]
            local_titles = [normalize(t["title"]) for t in valid_local]
            sp_artists = [normalize(t["artist"]) for t in sp_tracks]
            sp_titles = [normalize(t["title"]) for t in sp_tracks]

            # Score artist and title separately; track must match well on BOTH.
            # token_sort_ratio is order-insensitive but less lenient than token_set_ratio.
            artist_m = process.cdist(
                sp_artists, local_artists,
                scorer=fuzz.token_sort_ratio, dtype=np.uint8,
            )
            # Use token_set_ratio for titles so a Spotify title can match a
            # library title that contains extra qualifier words (e.g. "Touch"
            # matches "Touch (HH Clean Intro)"). Artist still uses sort_ratio
            # to avoid loose matches based on shared common words.
            title_m = process.cdist(
                sp_titles, local_titles,
                scorer=fuzz.token_set_ratio, dtype=np.uint8,
            )
            combined = np.minimum(artist_m, title_m)
            best_idx = combined.argmax(axis=1)
            best_scores = combined.max(axis=1)

            for i, sp_track in enumerate(sp_tracks):
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
                results.append({"spotify": sp_track, "match": match})

        return {
            "playlist": {
                "id": playlist["id"],
                "name": playlist["name"],
                "owner": playlist["owner"],
                "track_count": len(sp_tracks),
            },
            "summary": {"total": len(sp_tracks), **counts},
            "results": results,
        }
