"""Top 100 chart source: Apple Music's public iTunes RSS "Top Songs" feed.

No auth required, updated daily, and supports per-genre charts. We fuzzy-match
the chart against the local library via matching.match_tracks."""
import requests

from matching import match_tracks

COUNTRY = "us"
LIMIT = 100
FEED_URL = "https://itunes.apple.com/{country}/rss/topsongs/limit={limit}/{genre_seg}json"

# Genres offered in the UI. Only Apple top-level genres that return real,
# genre-appropriate charts are included (subgenres like Dancehall/Soca/House
# don't return reliable results from this feed). "" = the overall chart.
GENRES = [
    {"id": "", "label": "Overall"},
    {"id": "18", "label": "Hip-Hop/Rap"},
    {"id": "15", "label": "R&B/Soul"},
    {"id": "14", "label": "Pop"},
    {"id": "17", "label": "Dance"},
    {"id": "7", "label": "Electronic"},
    {"id": "24", "label": "Reggae"},
    {"id": "12", "label": "Latino"},
    {"id": "21", "label": "Rock"},
    {"id": "6", "label": "Country"},
]
_VALID_GENRE_IDS = {g["id"] for g in GENRES}


def fetch_chart(country: str = COUNTRY, limit: int = LIMIT, genre: str = "") -> dict:
    if genre not in _VALID_GENRE_IDS:
        raise ValueError(f"Unknown genre id: {genre}")
    genre_seg = f"genre={genre}/" if genre else ""
    url = FEED_URL.format(country=country, limit=limit, genre_seg=genre_seg)
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    feed = resp.json().get("feed", {})

    entries = feed.get("entry", [])
    if isinstance(entries, dict):  # the feed returns a bare object for a single result
        entries = [entries]

    tracks = []
    for i, e in enumerate(entries):
        category = e.get("category", {}).get("attributes", {})
        tracks.append({
            "id": e.get("id", {}).get("attributes", {}).get("im:id") or e.get("id", {}).get("label", ""),
            "title": e.get("im:name", {}).get("label", ""),
            "artist": e.get("im:artist", {}).get("label", ""),
            "url": e.get("id", {}).get("label", ""),
            "rank": i + 1,
            "genres": [category["label"]] if category.get("label") else [],
        })

    return {
        "source": feed.get("title", {}).get("label") or "Apple Music — Top Songs",
        "country": country.upper(),
        "tracks": tracks,
    }


def top_tracks(local_tracks: list, country: str = COUNTRY, limit: int = LIMIT, genre: str = "") -> dict:
    chart = fetch_chart(country, limit, genre)
    # Each result's "track" is the same dict from chart["tracks"], so rank and
    # genres are already attached.
    matched = match_tracks(chart["tracks"], local_tracks)
    return {
        "source": chart["source"],
        "country": chart["country"],
        "genre": genre,
        "genres": GENRES,
        "summary": matched["summary"],
        "results": matched["results"],
    }
