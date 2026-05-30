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
- `backend/spotify_compare.py` (spotipy OAuth), `spotify_embed.py`, `top_charts.py` (Apple RSS), `itunes_genre.py` — chart/genre sources.
- `frontend/src/App.jsx` + `src/components/*`; shadcn/ui primitives in `src/components/ui/`.

## Gotchas
- Rekordbox must be CLOSED — it locks master.db. "Library not loaded" = it's still open.
- Spotify editorial playlists (`37i9dQZF1…`) are blocked by the Web API; use the embed source instead.
- Radix `SelectItem` must never have `value=""` — map empty ids to a sentinel (it crashes otherwise).
- Secrets live in `backend/.env` + `backend/.spotify_token` (git-ignored).

## Conventions
- Frontend: Tailwind v4 + shadcn/ui; path alias `@/`. Backend: plain modules, no package, run from `backend/`.

See README.md (setup) and PRODUCT.md (feature specs) for detail.
