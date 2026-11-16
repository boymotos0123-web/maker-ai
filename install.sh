#!/usr/bin/env bash
# Instalador do ZeyForge (Linux / macOS / Termux)
#   curl -fsSL https://raw.githubusercontent.com/boymotos0123-web/zeyforge/main/install.sh | bash
#   ... | bash -s -- --desktop     (instala também o app desktop com Electron)
set -e
DIR="${ZEYFORGE_DIR:-$HOME/zeyforge}"
REPO="https://github.com/boymotos0123-web/zeyforge.git"
command -v git >/dev/null || { echo "Instale o git primeiro (sudo apt install git / pkg install git)"; exit 1; }
if [ -d "$DIR/.git" ]; then echo "Atualizando $DIR..."; git -C "$DIR" pull --ff-only
else echo "Baixando ZeyForge em $DIR..."; git clone --depth 1 "$REPO" "$DIR"; fi
chmod +x "$DIR/run.sh"
if [ "$1" = "--desktop" ]; then
  command -v npm >/dev/null || { echo "Para o app desktop instale o Node.js (nodejs.org)"; exit 1; }
  (cd "$DIR/desktop" && npm install)
  LAUNCH="cd '$DIR/desktop' && npx electron ."
else
  LAUNCH="'$DIR/run.sh'"
fi
# Atalho no menu de aplicativos (Linux)
if [ -d "$HOME/.local/share/applications" ] || [ "$(uname)" = "Linux" ]; then
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/zeyforge.desktop" <<DESK
[Desktop Entry]
Name=ZeyForge
Comment=CAD 3D de hardware
Exec=bash -c "$LAUNCH"
Icon=$DIR/icons/icon-512.png
Terminal=false
Type=Application
Categories=Graphics;Engineering;
DESK
fi
echo ""
echo "Pronto! Para abrir:  $LAUNCH"
