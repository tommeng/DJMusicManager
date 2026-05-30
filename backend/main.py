import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

load_dotenv()

from rekordbox_parser import RekordboxLibrary
from spotify_compare import SpotifyCompare
import top_charts

library = RekordboxLibrary(os.environ.get("REKORDBOX_DB"))
spotify = SpotifyCompare()
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
        "spotify_configured": spotify.configured,
        "spotify_authenticated": spotify.authenticated,
        "track_count": len(library.all_tracks),
    }


@app.get("/api/spotify/auth-url")
def spotify_auth_url():
    if not spotify.configured:
        raise HTTPException(503, "Spotify credentials missing in backend/.env")
    return {"url": spotify.get_auth_url()}


@app.get("/callback")
def spotify_callback(code: str = None, error: str = None):
    if error:
        return RedirectResponse(f"http://localhost:5173/?spotify_error={error}")
    if not code:
        raise HTTPException(400, "Missing 'code' query parameter")
    try:
        spotify.handle_callback(code)
    except Exception as e:
        return RedirectResponse(f"http://localhost:5173/?spotify_error={e}")
    return RedirectResponse("http://localhost:5173/?spotify_connected=1")


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
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    if not spotify.configured:
        raise HTTPException(
            status_code=503,
            detail="Spotify credentials missing. Set SPOTIFY_CLIENT_ID/SECRET in backend/.env and restart.",
        )
    if not spotify.authenticated:
        raise HTTPException(
            status_code=401,
            detail="Not connected to Spotify. Click 'Connect Spotify' first.",
        )
    try:
        return spotify.compare(req.playlist_url, library.all_tracks)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Spotify error: {e}")


@app.get("/api/top100")
def top100(genre: str = ""):
    """Current top tracks from Apple Music's iTunes Top Songs chart (optionally
    for a single genre), matched against the local library. No Spotify auth."""
    if not library.loaded:
        raise HTTPException(status_code=503, detail="Library not loaded")
    try:
        return top_charts.top_tracks(library.all_tracks, genre=genre)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chart source error: {e}")
