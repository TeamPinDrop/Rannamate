#!/bin/bash
# RANNAMATE frontend launcher — double-click in Finder
cd "$(dirname "$0")/frontend" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js / npm not found. Install Node 20+ from https://nodejs.org and run this again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
echo "Node $(node -v) · npm $(npm -v)"
echo "Installing dependencies…"
npm install || { read -n 1 -s -r -p "npm install failed — press any key"; exit 1; }
( sleep 6; open "http://localhost:3000" ) &
echo "Starting dev server on http://localhost:3000 (Ctrl+C to stop)"
npm run dev
