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
_PLAYLIST_ID_RE = re.compile(r"(?:playlist[:/])([a-zA-Z0-9]+)")


def extract_playlist_id(url_or_uri: str) -> str:
    m = _PLAYLIST_ID_RE.search(url_or_uri)
    if not m:
        raise ValueError(f"Could not extract a Spotify playlist ID from: {url_or_uri}")
    return m.group(1)


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


def compare(playlist_url: str, local_tracks: list) -> dict:
    """Compare any public Spotify playlist against the local library.

    Reads the playlist from the public embed page (no auth), so it works on
    editorial and other users' playlists alike. The embed payload has no album
    or duration, so those Compare columns stay blank."""
    playlist_id = extract_playlist_id(playlist_url)
    playlist = fetch_playlist(playlist_id)
    matched = match_tracks(playlist["tracks"], local_tracks)
    return {
        "playlist": {
            "id": playlist_id,
            "name": playlist["source"],
            "owner": "",
            "track_count": len(playlist["tracks"]),
        },
        "summary": matched["summary"],
        "results": matched["results"],
    }
