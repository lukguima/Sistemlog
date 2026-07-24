#!/bin/sh
set -e

# BFF de auth em background
node /app/server/index.js &
BFF_PID=$!

cleanup() {
  kill "$BFF_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Nginx em foreground
nginx -g 'daemon off;'
