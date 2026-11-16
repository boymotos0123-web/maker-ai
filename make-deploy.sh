#!/usr/bin/env bash
# Gera zeyforge-web.zip só com o que vai para a hospedagem (InfinityFree, Hostinger, etc.)
set -e
cd "$(dirname "$0")"
rm -f zeyforge-web.zip
zip -rq zeyforge-web.zip index.html manifest.json sw.js .htaccess css src vendor icons
echo "Gerado: zeyforge-web.zip -> extraia dentro de htdocs/"
