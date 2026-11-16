#!/bin/sh
# Packs the game for upload to the Yandex Games console: dist/alchemist-vs-slimes-yandex.zip
# with index.html in the root and only the files the game needs (requirements 1.21, 1.22).
set -eu
cd "$(dirname "$0")/.."
FILES="index.html game.js playgama-bridge.js playgama-bridge-config.json platform-bridges assets"
for f in $FILES; do [ -e "$f" ] || { echo "missing: $f (run tools/update-bridge.sh for the bridge)"; exit 1; }; done

# 1.7: no absolute addresses of other hosts in the code that would be blocked or are forbidden
if grep -n -E 'https?://(bridge\.playgama\.com|games\.s3\.yandex\.net)' index.html game.js; then
  echo "remove absolute URLs above"; exit 1
fi
# 1.22: no spaces or non-Latin characters in file names
BAD=$(find $FILES -print | LC_ALL=C grep -n '[^A-Za-z0-9._/-]' || true)
[ -z "$BAD" ] || { echo "bad file names:"; echo "$BAD"; exit 1; }

mkdir -p dist
OUT=dist/alchemist-vs-slimes-yandex.zip
rm -f "$OUT"
zip -qr -X "$OUT" $FILES -x '*.DS_Store'
# 1.21: unpacked size up to 100 MB
SIZE=$(unzip -l "$OUT" | tail -1 | awk '{print $1}')
echo "$OUT: $(ls -lh "$OUT" | awk '{print $5}') packed, $((SIZE / 1024)) KB unpacked (limit 100 MB)"
[ "$SIZE" -le 104857600 ] || { echo "too big for Yandex Games"; exit 1; }
