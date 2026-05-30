#!/usr/bin/env bash
# Start the backend (FastAPI, :8000) and frontend (Vite, :5173) together.
# First run sets up the Python venv and installs deps automatically.
# Press Ctrl-C to stop both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- Backend setup ---
if [ ! -d "backend/.venv" ]; then
  echo "==> Creating Python venv (backend/.venv)"
  python3 -m venv backend/.venv
fi
# shellcheck disable=SC1091
source backend/.venv/bin/activate
echo "==> Installing backend deps"
pip install -q -r backend/requirements.txt

# --- Frontend setup ---
if [ ! -d "frontend/node_modules" ]; then
  echo "==> Installing frontend deps"
  (cd frontend && npm install)
fi

# --- Run both; kill both when this script exits ---
pids=()
cleanup() {
  echo
  echo "==> Stopping..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

echo "==> Starting backend on http://localhost:8000"
(cd backend && exec uvicorn main:app --reload --port 8000) &
pids+=($!)

echo "==> Starting frontend on http://localhost:5173"
(cd frontend && exec npm run dev) &
pids+=($!)

# Block until interrupted (Ctrl-C) or both processes exit; cleanup runs via trap.
wait
