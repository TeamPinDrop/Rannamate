#!/bin/bash
# RANNAMATE launcher — double-click in Finder
# Starts both the backend (port 4000) and the website (port 3000)
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/start-rannamate.command"
