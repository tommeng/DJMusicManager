# DJ Music Manager

A locally-run web app for managing the music you DJ with. It reads your
**Rekordbox** library directly and lets you:

- **Browse playlists** — navigate your Rekordbox folder/playlist tree and view tracks (title, artist, BPM, key, duration, file path).
- **Search your library** — fast substring search across title, artist, and album.
- **Compare against a Spotify playlist** — paste any public Spotify playlist URL (your own, someone else's, or a Spotify editorial playlist) and see which tracks are *missing* from your Rekordbox collection, using fuzzy matching that ignores `(feat. …)`, remix/version tags, etc. No Spotify login required.
- **Top Charts** — pull the current Apple Music "Top Songs" or Spotify "Today's Top Hits" chart and see at a glance which trending tracks are already in your library, *uncertain*, or *missing* — with genre tags and one-click copy. No Spotify login required.

Everything runs on your own machine. Nothing about your library is uploaded
anywhere — the app reads your local Rekordbox database and, to fetch playlists
and charts, makes read-only requests to public endpoints (Apple Music's RSS
feed, the iTunes Search API, and Spotify's public embed page).

---

## Requirements

- **macOS or Windows** — Rekordbox (and therefore its database) doesn't run on Linux.
- **Python 3.9+**
- **Node.js 18+** (for the frontend / Vite)
- **Rekordbox 6 or 7** installed, with a library you've used at least once.

No Spotify account or API credentials are needed — playlists and charts are read from public endpoints.

---

## Quick start

The app has two parts that run at the same time: a **backend** (FastAPI, port
8000) and a **frontend** (Vite dev server, port 5173).

**Fastest path (macOS/Linux):** after cloning, just run the helper script — it
creates the Python venv, installs both backends' deps on first run, and starts
both servers (Ctrl-C stops them):

```bash
./dev.sh
```

> Still quit Rekordbox first (it locks the database).

To run the two parts manually (or on Windows), open two terminals and follow
the steps below.

### 1. Clone

```bash
git clone git@github.com:tommeng/DJMusicManager.git
cd DJMusicManager
```

### 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

> **About the encrypted database:** Rekordbox 6/7 stores its library in an
> **encrypted** SQLite database (`master.db`). Reading it requires the
> **SQLCipher** library, which is installed automatically by the
> `sqlcipher3-wheels` entry in `requirements.txt` (prebuilt binaries — no
> compilation). pyrekordbox supplies the decryption key itself, so there's no
> extra key-download step. If `pip install` can't find a SQLCipher wheel for
> your platform, build it once with:
>
> ```bash
> python -m pyrekordbox install-sqlcipher
> ```

#### Run the backend

> ⚠️ **Close Rekordbox before starting.** Rekordbox locks `master.db` while it's
> running, so the app can't read it until you quit Rekordbox.

```bash
uvicorn main:app --reload --port 8000
```

On startup you should see something like
`Loaded N top-level items, M total tracks`. If you instead see a
`Library not loaded` warning, see [Troubleshooting](#troubleshooting).

The Rekordbox database path is **auto-detected** (typically
`~/Library/Pioneer/rekordbox/master.db` on macOS). To point at a different
location, set `REKORDBOX_DB`:

```bash
REKORDBOX_DB="/path/to/master.db" uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default <http://localhost:5173>). The frontend proxies
`/api` calls to the backend on port 8000, so no extra config is needed.

At this point **everything works** — no Spotify setup required. The Compare and
Top Charts tabs read Spotify playlists from the public embed page, so any public
playlist (yours, someone else's, or a Spotify editorial playlist) works without
logging in.

> Because the embed page doesn't expose album or track duration, those two
> columns stay blank in the Compare table.

---

## Top Charts

The **Top Charts** tab fetches a live chart and runs it through the same matcher
as Compare, so you can see which trending tracks you're missing. Pick a source
from the dropdown:

- **Spotify — Today's Top Hits** — read from Spotify's public playlist embed
  page. Genres aren't in that payload, so they're looked up per-track via the
  iTunes Search API.
- **Apple Music — Top Songs** — Apple's daily "most-played" RSS feed, which
  already includes genre tags.

Results are tagged **In library / Maybe / Missing** (same thresholds as below),
with clickable stat chips to filter and a copy button per row.

## How matching works (Compare & Top Charts)

Both features share the same matcher (`backend/matching.py`):

- Each title and artist is normalized: lowercased, with `(feat. …)`,
  `(Remastered …)`, `- Extended Mix`, and other version/qualifier tags stripped.
- Artist and title are fuzzy-scored **separately** against your whole Rekordbox
  collection with `rapidfuzz`'s order-insensitive `token_set_ratio`, then
  combined by taking the lower of the two — a track must match well on *both*.
- Combined score **≥ 85** → match (in library); **70–84** → *Uncertain* (worth a
  manual check); **< 70** → *Missing*.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Library not loaded` on startup | Rekordbox is still open — quit it and hit refresh (or restart the backend). |
| `Could not unlock database: 'sqlcipher3' package not found` | SQLCipher didn't install. Re-run `pip install -r requirements.txt`, or build it with `python -m pyrekordbox install-sqlcipher`. |
| `Could not open Rekordbox database` | Wrong path — set `REKORDBOX_DB` to your `master.db`, or you're on an unsupported Rekordbox version. |
| Empty playlist tree | You may have only smart playlists (currently skipped) or an empty library. |
| Compare returns nothing / errors | The playlist must be **public** (private playlists aren't readable via the embed page). Double-check the URL. |
| Edited your library in Rekordbox | Quit Rekordbox, then hit the ↻ refresh button in the Playlists header (no restart needed). |

---

## Security / privacy

- No Spotify credentials or login are involved — playlists and charts are read
  from public endpoints with anonymous read-only requests.
- The app reads your Rekordbox database **read-only** and makes no changes to it.

---

## Project layout

```
backend/    FastAPI app — Rekordbox parsing (pyrekordbox) + chart sources
  main.py             API endpoints
  rekordbox_parser.py reads master.db
  matching.py         shared fuzzy matcher (Compare + Top Charts)
  spotify_embed.py    reads any public Spotify playlist via the embed page (Compare + Top Charts)
  top_charts.py       Apple Music "Top Songs" RSS chart source
  itunes_genre.py     genre lookup via the iTunes Search API
frontend/   React + Vite UI (Tailwind v4 + shadcn/ui)
  src/App.jsx, src/components/*
```
