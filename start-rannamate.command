#!/bin/bash
# RANNAMATE — one-click local start (double-click in Finder).
# Stops any old copies on ports 3000 / 3001 / 4000, then starts the backend (port 4000) and the website (port 3000).
# Close this window (or press Ctrl+C) to stop both.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
command -v npm >/dev/null 2>&1 || { echo "Node.js / npm not found. Install Node 20+ from https://nodejs.org"; read -r -p "Press Enter to close"; exit 1; }

echo "→ Stopping old copies…"
for p in 3000 3001 4000; do
  pids=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null && echo "   freed port $p"
done

[ -f backend/.env ] || { echo "✗ backend/.env is missing — see backend/README.md"; read -r -p "Press Enter to close"; exit 1; }
[ -d backend/node_modules ] || { echo "→ Installing backend packages (first time only)…"; npm --prefix backend install || exit 1; }
[ -d frontend/node_modules ] || { echo "→ Installing website packages (first time only)…"; npm --prefix frontend install || exit 1; }

echo "→ Starting backend on http://localhost:4000 (log: backend.log)…"
npm --prefix backend run dev > backend.log 2>&1 &
stop_backend() { pids=$(lsof -ti tcp:4000 -sTCP:LISTEN 2>/dev/null); [ -n "$pids" ] && kill $pids 2>/dev/null; }
trap stop_backend EXIT INT TERM

for i in $(seq 1 40); do
  curl -s http://localhost:4000/api/v1/health >/dev/null 2>&1 && break
  sleep 1
done
if curl -s http://localhost:4000/api/v1/health | grep -q '"status":"ok"'; then
  echo "✓ Backend running and connected to the database"
else
  echo "! Backend started but the database check didn't pass — details: http://localhost:4000/api/v1/health"
fi

echo "→ Starting website on http://localhost:3000 …"
(sleep 6; open "http://localhost:3000") &
npm --prefix frontend run dev -- -p 3000
