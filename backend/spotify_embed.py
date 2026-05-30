"""Spotify playlist source via the public embed page (no auth).

Spotify's Web API blocks its own editorial playlists (the 37i9dQZF1DX... ids),
so we read the tracklist from the embed page's __NEXT_DATA__ JSON blob instead.
Same chart-track shape as top_charts, matched against the local library."""
import json
import re

import requests

import itunes_genre
from matching import match_tracks

EMBED_URL = "https://open.spotify.com/embed/playlist/{playlist_id}"
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S
)


def fetch_playlist(playlist_id: str) -> dict:
    resp = requests.get(
        EMBED_URL.format(playlist_id=playlist_id),
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=15,
    )
    resp.raise_for_status()

    m = _NEXT_DATA_RE.search(resp.text)
    if not m:
        raise ValueError("Spotify embed page had no __NEXT_DATA__ payload")
    entity = json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"]

    tracks = []
    for i, t in enumerate(entity.get("trackList", [])):
        tid = (t.get("uri") or "").rsplit(":", 1)[-1]
        tracks.append({
            "id": tid,
            "title": t.get("title", ""),
            "artist": t.get("subtitle", ""),  # Spotify joins collaborators here
            "url": f"https://open.spotify.com/track/{tid}" if tid else "",
            "rank": i + 1,
            "genres": [],  # not exposed by the embed payload
        })

    return {"source": entity.get("name") or "Spotify playlist", "tracks": tracks}


def top_tracks(local_tracks: list, playlist_id: str) -> dict:
    chart = fetch_playlist(playlist_id)
    itunes_genre.enrich(chart["tracks"])  # embed has no genres; look them up
    matched = match_tracks(chart["tracks"], local_tracks)
    return {
        "source": chart["source"],
        "country": "",
        "summary": matched["summary"],
        "results": matched["results"],
    }
