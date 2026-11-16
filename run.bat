@echo off
REM Roda o ZeyForge localmente no Windows
cd /d "%~dp0"
set PORT=8080
start "" http://localhost:%PORT%
where python >nul 2>nul && (python -m http.server %PORT% --bind 127.0.0.1 & goto :eof)
where npx >nul 2>nul && (npx --yes serve -l %PORT% . & goto :eof)
echo Instale Python (python.org) ou Node.js (nodejs.org) para rodar.
pause
