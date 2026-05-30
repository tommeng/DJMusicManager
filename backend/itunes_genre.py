"""Genre enrichment via the iTunes Search API (no auth).

Some chart sources (e.g. the Spotify embed) carry no genre data, so we look up
each track's primaryGenreName from Apple. Lookups run concurrently and are
cached in-process so refreshes don't re-query the same tracks."""
import requests
from concurrent.futures import ThreadPoolExecutor

SEARCH_URL = "https://itunes.apple.com/search"
_cache: dict = {}


def _lookup(title: str, artist: str) -> list:
    key = (title, artist)
    if key in _cache:
        return _cache[key]
    genres = []
    try:
        resp = requests.get(
            SEARCH_URL,
            params={"term": f"{artist} {title}".strip(), "entity": "song", "limit": 1},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
        if results and results[0].get("primaryGenreName"):
            genres = [results[0]["primaryGenreName"]]
    except requests.RequestException:
        genres = []  # best-effort: leave genre blank rather than failing the chart
    _cache[key] = genres
    return genres


def enrich(tracks: list, max_workers: int = 8) -> None:
    """Fill each track's 'genres' in place, skipping any that already have one."""
    todo = [t for t in tracks if not t.get("genres")]
    if not todo:
        return
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        looked_up = ex.map(lambda t: _lookup(t.get("title", ""), t.get("artist", "")), todo)
        for track, genres in zip(todo, looked_up):
            track["genres"] = genres
