import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from rekordbox_parser import RekordboxLibrary
import top_charts
import spotify_embed
import ai_analysis

library = RekordboxLibrary(os.environ.get("REKORDBOX_DB"))

# Selectable chart sources for /api/top100, keyed by the id the UI sends.
SPOTIFY_TODAYS_TOP_HITS = "37i9dQZF1DXcBWIGoYBM5M"
CHART_SOURCES = {
    "apple-top-songs": lambda lib: top_charts.top_tracks(lib),
    "spotify-todays-top-hits": lambda lib: spotify_embed.top_tracks(lib, SPOTIFY_TODAYS_TOP_HITS),
}
load_error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global load_error
    try:
        library.load()
        print(f"Loaded {len(library.tree)} top-level items, {len(library.all_tracks)} total tracks")
    except Exception as e:
        load_error = str(e)
        print(f"Warning: {load_error}")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/status")
def status():
    return {
        "loaded": library.loaded,
        "error": load_error,
        "track_count": len(library.all_tracks),
    }


@app.post("/api/library/refresh")
def refresh_library():
    global load_error
    try:
        library.load()
        load_error = None
        return {
            "loaded": True,
            "track_count": len(library.all_tracks),
            "playlist_count": len(library.tree),
        }
    except Exception as e:
        load_error = str(e)
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/playlists")
def get_playlists():
    if not library.loaded:
        raise HTTPException(
            status_code=503,
            detail=load_error or "Library not loaded. Make sure Rekordbox is closed and restart the server.",
        )
    return library.tree


@app.get("/api/playlists/{playlist_id}/tracks")
def get_tracks(playlist_id: str):
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    tracks = library.get_playlist_tracks(playlist_id)
    if tracks is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return tracks


@app.post("/api/playlists/{playlist_id}/analyze")
def analyze_playlist(playlist_id: str):
    """AI genre/vibe analysis of a playlist. Aggregates stats locally, then
    asks Claude for a natural-language summary. Needs ANTHROPIC_API_KEY."""
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    tracks = library.get_playlist_tracks(playlist_id)
    if tracks is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    try:
        return ai_analysis.analyze(library.playlist_name(playlist_id), tracks)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis error: {e}")


@app.get("/api/search")
def search(q: str = "", limit: int = 500):
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    needles = [w for w in q.strip().lower().split() if w]
    if not needles:
        return []
    results = []
    for t in library.all_tracks:
        haystack = f"{t['title']} {t['artist']} {t['album']}".lower()
        if all(n in haystack for n in needles):
            results.append(t)
            if len(results) >= limit:
                break
    return results


class CompareRequest(BaseModel):
    playlist_url: str


@app.post("/api/spotify/compare")
def spotify_compare(req: CompareRequest):
    """Compare any public Spotify playlist against the local library.

    Reads the playlist from the public embed page (same source as Top Charts),
    so no Spotify login is needed and editorial / other users' playlists work."""
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    try:
        return spotify_embed.compare(req.playlist_url, library.all_tracks)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Spotify error: {e}")


@app.get("/api/top100")
def top100(source: str = "apple-top-songs"):
    """Current top tracks from the selected chart source, matched against the
    local library. No Spotify auth required."""
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    fetch = CHART_SOURCES.get(source)
    if not fetch:
        raise HTTPException(status_code=400, detail=f"Unknown source: {source}")
    try:
        return fetch(library.all_tracks)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chart source error: {e}")
