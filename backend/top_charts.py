"""Top 100 chart source: Apple Music's official "Top Songs" RSS feed.

Served from Apple's modern marketing-tools RSS API (no auth, updated daily).
This is the same chart Apple Music surfaces as Top 100. We fuzzy-match it
against the local library via matching.match_tracks."""
import requests

from matching import match_tracks

COUNTRY = "us"
LIMIT = 100
FEED_URL = "https://rss.marketingtools.apple.com/api/v2/{country}/music/most-played/{limit}/songs.json"

# "Music" is Apple's catch-all parent genre and isn't useful as a tag.
_SKIP_GENRES = {"Music"}


def fetch_chart(country: str = COUNTRY, limit: int = LIMIT) -> dict:
    url = FEED_URL.format(country=country, limit=limit)
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    feed = resp.json().get("feed", {})

    tracks = []
    for i, e in enumerate(feed.get("results", [])):
        genres = [g["name"] for g in e.get("genres", []) if g.get("name") not in _SKIP_GENRES]
        tracks.append({
            "id": e.get("id", ""),
            "title": e.get("name", ""),
            "artist": e.get("artistName", ""),
            "url": e.get("url", ""),
            "rank": i + 1,
            "genres": genres,
        })

    return {
        "source": feed.get("title", "Apple Music — Top Songs"),
        "country": country.upper(),
        "tracks": tracks,
    }


def top_tracks(local_tracks: list, country: str = COUNTRY, limit: int = LIMIT) -> dict:
    chart = fetch_chart(country, limit)
    # Each result's "track" is the same dict from chart["tracks"], so rank and
    # genres are already attached.
    matched = match_tracks(chart["tracks"], local_tracks)
    return {
        "source": chart["source"],
        "country": chart["country"],
        "summary": matched["summary"],
        "results": matched["results"],
    }
