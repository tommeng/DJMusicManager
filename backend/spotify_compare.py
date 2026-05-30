import os
import re

import spotipy
from spotipy.oauth2 import SpotifyOAuth, CacheFileHandler

from matching import match_tracks

REDIRECT_URI = "http://127.0.0.1:8000/callback"
SCOPES = "playlist-read-private playlist-read-collaborative"
TOKEN_CACHE = ".spotify_token"


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
        matched = match_tracks(playlist["tracks"], local_tracks)

        return {
            "playlist": {
                "id": playlist["id"],
                "name": playlist["name"],
                "owner": playlist["owner"],
                "track_count": len(playlist["tracks"]),
            },
            "summary": matched["summary"],
            "results": matched["results"],
        }
