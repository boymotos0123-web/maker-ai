#!/usr/bin/env bash
# Roda o ZeyForge localmente no navegador (Linux, macOS, Termux/Android).
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
URL="http://localhost:$PORT"
echo "ZeyForge rodando em $URL  (Ctrl+C para parar)"
( sleep 1; (xdg-open "$URL" || open "$URL" || termux-open-url "$URL") >/dev/null 2>&1 || true ) &
if command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v npx >/dev/null 2>&1; then exec npx --yes serve -l "$PORT" .
else echo "Instale python3 ou node para rodar." ; exit 1; fi
