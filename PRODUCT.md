# DJ Music Manager — Product Doc

## Overview
A locally-run web app for managing music used in DJing. Integrates with Rekordbox to provide playlist and track browsing and management.

---

## Features

### Rekordbox Playlist Browser

**Summary**
Parse the local Rekordbox library XML file and display all playlists. Selecting a playlist shows all tracks in it.

**User Flow**
1. On load, the app reads the local Rekordbox database
2. The left panel displays the playlist tree, preserving Rekordbox's folder/playlist nesting
3. Folders show a caret (▸/▾) and can be collapsed/expanded by clicking them
4. Siblings are sorted alphabetically (case-insensitive) at each level
5. Clicking a playlist loads and displays all tracks in that playlist

**Track Fields Displayed**
- Title
- Artist
- BPM
- Key
- Duration
- File path

**Technical Notes**
- Reads the Rekordbox 6+ encrypted database (`master.db`) directly via the [`pyrekordbox`](https://github.com/dylanljones/pyrekordbox) library — no manual XML export needed
- Default DB path is auto-detected (typically `~/Library/Pioneer/rekordbox/master.db` on macOS); can be overridden with the `REKORDBOX_DB` env var
- **Rekordbox must be closed** while the app reads the DB (file is locked while Rekordbox is running)
- Folders are shown as expandable nodes in the tree; smart playlists are currently skipped
- A ↻ refresh button in the Playlists header reloads the library from `master.db` without restarting the backend (endpoint: `POST /api/library/refresh`); use this after editing your library in Rekordbox

---

### Library Search

**Summary**
A search input at the top of the playlist panel filters across the entire library by track title, artist, and album.

**User Flow**
1. Type into the **Search library...** input above the playlist tree
2. The right panel switches to search results (titled `Search: "..."`)
3. Multi-word queries are AND'd together — every term must appear somewhere in title/artist/album
4. Clicking a playlist or hitting the × clears the search and returns to the normal playlist view

**Technical Notes**
- Backend endpoint: `GET /api/search?q=<query>&limit=500`
- Case-insensitive substring match (no fuzzy matching here — exact substrings, fast)
- Searched fields: `title`, `artist`, `album`
- Input is debounced 200ms in the frontend before hitting the API

---

### Spotify Playlist Compare

**Summary**
Paste a Spotify playlist URL; the app fetches all tracks and shows which ones aren't in the local Rekordbox library so they can be downloaded and added. Fuzzy matching handles small differences in titles, featured artist tags, remix labels, etc.

**User Flow**
1. Click the **Compare** tab in the header
2. Paste a public Spotify playlist URL (e.g. `https://open.spotify.com/playlist/...`)
3. Click **Compare**
4. By default the view shows **missing** tracks — the ones you need to acquire. Each title links straight to the Spotify track so you can listen/identify before sourcing it.
5. Filter chips (Missing / Uncertain / In library / Total) let you switch views. **Uncertain** is for matches that scored between 70–84 and are worth a manual sanity-check.

**Matching Logic**
- Each track is normalized: lowercase, with `(feat. ...)`, `(Remastered ...)`, `- Extended Mix` etc. stripped
- Match key = normalized artist + title
- Scored against the entire local library using `rapidfuzz.fuzz.token_set_ratio` (order-insensitive)
- Score ≥ 85 → **Match**; 70–84 → **Uncertain** (likely a match worth verifying); <70 → **Missing**

**Technical Notes**
- Reads the playlist from Spotify's **public embed page** (`backend/spotify_embed.py`, the same source as Top Charts) by parsing its `__NEXT_DATA__` JSON. No OAuth, no credentials, no login.
- Works on **any public playlist** — your own, other users', and Spotify-owned editorial playlists (`37i9dQZF1...`), which the Web API blocks.
- The embed payload has no album or track duration, so those columns are blank in the Compare table (titles, artists, and Spotify track links are present).
- Private playlists aren't readable (the embed page only serves public ones).
- Matches against the full Rekordbox collection (deduplicated), not the currently-selected playlist

---

### Top Charts

**Summary**
Pull a live "what's hot right now" chart and run it through the same matcher as Compare, so you can see which trending tracks you're missing and should add to your crates.

**User Flow**
1. Click the **Top Charts** tab in the header
2. Pick a source from the dropdown (defaults to Spotify — Today's Top Hits); switching sources reloads the chart
3. Each row is tagged **In library** / **Maybe** / **Missing**, with genre tags, the best local match + score, and an external link to the track
4. Filter chips (Missing / Maybe / In library / Total) narrow the view; a copy button per row grabs "Title Artist" for sourcing
5. **Refresh** re-fetches the current chart

**Chart Sources**
- **Spotify — Today's Top Hits** (`37i9dQZF1DXcBWIGoYBM5M`) — read from Spotify's public embed page (same source as Compare). That payload has no genres, so each track's genre is looked up via the iTunes Search API.
- **Apple Music — Top Songs** — Apple's daily "most-played" RSS feed, which already includes genre tags.

**Technical Notes**
- Backend endpoint: `GET /api/top100?source=<id>`; sources are registered in the `CHART_SOURCES` dict in `main.py` — add a new one there to expose it in the dropdown
- Same matcher and thresholds as Compare (`matching.py`): ≥85 match, 70–84 uncertain, <70 missing, scored against the full local library
- No Spotify auth required (public embed page + public Apple RSS + iTunes Search API)

---

### AI Playlist Analysis

**Summary**
For a selected Rekordbox playlist, produce a genre/vibe writeup. Stats are aggregated locally in Python; only a compact summary is sent to Claude, which returns a structured analysis. Optional — requires an Anthropic API key.

**User Flow**
1. Select a playlist in the **Library** tab (the button doesn't appear for search results)
2. Click **AI Analyze** in the track panel header
3. A side panel opens with the locally-computed stats (BPM min/avg/max, top genres, top keys) plus Claude's analysis: overall vibe, primary genres, energy level, "best for" settings, and a few notable tracks
4. Results are cached per playlist in `App.jsx`, so reopening the panel doesn't re-hit the API
5. Without an API key the button is disabled and the endpoint returns a setup message that surfaces in the panel

**Technical Notes**
- Backend endpoint: `POST /api/playlists/{id}/analyze` (`backend/ai_analysis.py`)
- Model: Claude Sonnet 4.6, with structured JSON output enforced via a JSON schema
- Requires `ANTHROPIC_API_KEY` in `backend/.env` (see README "AI Analyze (optional)"); a missing key returns HTTP 400 with a setup message
- Privacy: track stats are computed on the machine; only the aggregated summary and a capped representative sample (max 60 tracks) are sent to Anthropic — never the full library or your files
- Errors map to clean HTTP codes: empty playlist / missing key → 400, upstream API failure → 502

---

### Health — Broken Track Detection

**Summary**
Scans the library for tracks whose audio file is missing, so they can be re-linked or removed in Rekordbox before they fail to load mid-set.

**User Flow**
1. Click the **Health** tab in the header
2. The library is scanned on open; a summary shows total tracks scanned and how many are broken
3. Filter chips split the results: **File missing** / **No file** / **Broken** (all)
4. Each row shows the track title/artist, its stored file path, and a copy button for the path
5. **Rescan** re-checks after files are moved/restored (a clean library shows a "no broken tracks" state)

**What counts as broken**
- **`file_missing`** — Rekordbox has a `FolderPath` for the track, but nothing exists at that path on disk (moved, deleted, or an unsynced cloud folder)
- **`no_file`** — the track has no path stored at all

**Technical Notes**
- Backend endpoint: `GET /api/library/broken` → `{ tracks, summary }`, where `summary` has `total`, `broken`, `no_file`, and `file_missing` counts
- Detection runs against the current in-memory library snapshot (`rekordbox_parser.broken_tracks()`), using `os.path.exists` on each track's `FolderPath`
- Rescan reflects the loaded snapshot; if you move files, refresh the library (or Rescan) to re-check
