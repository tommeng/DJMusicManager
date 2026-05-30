# DJ Music Manager

A locally-run web app for managing the music you DJ with. It reads your
**Rekordbox** library directly and lets you:

- **Browse playlists** — navigate your Rekordbox folder/playlist tree and view tracks (title, artist, BPM, key, duration, file path).
- **Search your library** — fast substring search across title, artist, and album.
- **Compare against a Spotify playlist** — paste a Spotify playlist URL and see which tracks are *missing* from your Rekordbox collection, using fuzzy matching that ignores `(feat. …)`, remix/version tags, etc.
- **Top Charts** — pull the current Apple Music "Top Songs" or Spotify "Today's Top Hits" chart and see at a glance which trending tracks are already in your library, *uncertain*, or *missing* — with genre tags and one-click copy. No Spotify login required.

Everything runs on your own machine. Nothing about your library is uploaded
anywhere — the app reads your local Rekordbox database and, to fetch charts,
makes read-only requests to public endpoints (Apple Music's RSS feed, the
iTunes Search API, and Spotify's public embed/Web API).

---

## Requirements

- **macOS or Windows** — Rekordbox (and therefore its database) doesn't run on Linux.
- **Python 3.9+**
- **Node.js 18+** (for the frontend / Vite)
- **Rekordbox 6 or 7** installed, with a library you've used at least once.
- *(Optional, for the Spotify Compare feature)* a free [Spotify Developer](https://developer.spotify.com/dashboard) account.

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

> Still quit Rekordbox first (it locks the database), and set up `backend/.env`
> if you want the Spotify Compare feature — see below.

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

At this point **playlist browsing and search work**. The Spotify Compare tab
needs the extra setup below.

---

## Optional: Spotify Compare setup

The Compare feature needs your own Spotify app credentials (Spotify deprecated
anonymous access to playlist contents for new apps).

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and **Create app**.
2. In the app settings, add this **Redirect URI** exactly:
   ```
   http://127.0.0.1:8000/callback
   ```
3. Copy your **Client ID** and **Client Secret**.
4. Create `backend/.env` (copy the template):
   ```bash
   cd backend
   cp .env.example .env
   ```
   Then fill it in:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```
5. Restart the backend so it picks up the new `.env`.
6. In the app, open the **Compare** tab and click **Connect Spotify** to
   authorize once. Your token is cached locally in `backend/.spotify_token`.

### Notes on Spotify limitations

- New Spotify apps start in **Development Mode** (max 25 users). Your own
  account works immediately; to let anyone else use *your* app's credentials,
  add their Spotify email under **Users and Access** in the dashboard.
- Spotify's **editorial playlists** (IDs starting `37i9dQZF1…`) are not
  accessible via the API regardless of setup — use your own/user playlists.

---

## Top Charts

The **Top Charts** tab (no Spotify login needed) fetches a live chart and runs
it through the same matcher as Compare, so you can see which trending tracks
you're missing. Pick a source from the dropdown:

- **Spotify — Today's Top Hits** — read from Spotify's public playlist embed
  page (Spotify's Web API blocks its own editorial playlists). Genres aren't in
  that payload, so they're looked up per-track via the iTunes Search API.
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
| Compare says credentials missing | `backend/.env` is absent or not filled in; restart the backend after creating it. |
| Spotify auth fails / redirect error | The Redirect URI in the dashboard must be exactly `http://127.0.0.1:8000/callback`. |
| Edited your library in Rekordbox | Quit Rekordbox, then hit the ↻ refresh button in the Playlists header (no restart needed). |

---

## Security / privacy

- Your Spotify credentials live only in `backend/.env`, and your Spotify token
  in `backend/.spotify_token`. Both are git-ignored and never leave your machine.
- The app reads your Rekordbox database **read-only** and makes no changes to it.

---

## Project layout

```
backend/    FastAPI app — Rekordbox parsing (pyrekordbox) + chart sources
  main.py             API endpoints
  rekordbox_parser.py reads master.db
  spotify_compare.py  Spotify playlist fetch (spotipy) for the Compare tab
  matching.py         shared fuzzy matcher (Compare + Top Charts)
  top_charts.py       Apple Music "Top Songs" RSS chart source
  spotify_embed.py    Spotify "Today's Top Hits" via the public embed page
  itunes_genre.py     genre lookup via the iTunes Search API
frontend/   React + Vite UI (Tailwind v4 + shadcn/ui)
  src/App.jsx, src/components/*
```
