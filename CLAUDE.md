# DJ Music Manager — for Claude

Local web app: reads a Rekordbox library and compares it against Spotify
playlists / live charts. FastAPI backend + React (Vite) frontend. Everything
runs on the user's machine; nothing about the library is uploaded.

## Run / build
- `./dev.sh` — venv setup + both servers (backend :8000, frontend :5173). Ctrl-C stops both.
- Backend only: `cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000`
- Frontend only: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`

## Tests
- `cd backend && source .venv/bin/activate && python -m pytest` (needs `pip install pytest`).
- Only `matching.py` is covered so far (`backend/test_matching.py`). The rest is
  verified manually by running `./dev.sh` and using the UI.

## Architecture
- `backend/main.py` — all FastAPI endpoints. New chart sources go in the `CHART_SOURCES` dict.
- `backend/rekordbox_parser.py` — reads the encrypted master.db via pyrekordbox.
- `backend/matching.py` — shared fuzzy matcher (Compare + Top Charts). Thresholds: ≥85 match, 70–84 uncertain, <70 missing.
- `backend/spotify_embed.py` — reads any public Spotify playlist from the embed page's `__NEXT_DATA__` (no auth). Powers both Compare (`compare()`) and Top Charts (`top_tracks()`).
- `backend/top_charts.py` (Apple RSS), `itunes_genre.py` — chart/genre sources.
- `frontend/src/App.jsx` + `src/components/*`; shadcn/ui primitives in `src/components/ui/`.

## Gotchas
- Rekordbox must be CLOSED — it locks master.db. "Library not loaded" = it's still open.
- Compare and Top Charts both read Spotify via the embed page (no OAuth), so editorial (`37i9dQZF1…`) and other users' playlists work. The embed payload has no album/duration — those Compare columns stay blank.
- Radix `SelectItem` must never have `value=""` — map empty ids to a sentinel (it crashes otherwise).

## Conventions
- Frontend: Tailwind v4 + shadcn/ui; path alias `@/`. Backend: plain modules, no package, run from `backend/`.

See README.md (setup) and PRODUCT.md (feature specs) for detail.
