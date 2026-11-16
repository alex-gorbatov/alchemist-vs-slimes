#!/bin/sh
# Downloads Playgama Bridge into the game folder so the Yandex build loads nothing from other hosts
# (Yandex Games blocks external hosts by CSP). Run again to update the bridge.
# The bundle has its CDN address built in as the place to load platform modules from;
# it is replaced with "" so platform-bridges/yandex.js is loaded from next to index.html.
set -eu
cd "$(dirname "$0")/.."
BASE=https://bridge.playgama.com/v2/stable
mkdir -p platform-bridges
curl -fsSL "$BASE/playgama-bridge.js" -o playgama-bridge.js.tmp
curl -fsSL "$BASE/platform-bridges/yandex.js" -o platform-bridges/yandex.js
python3 -I - playgama-bridge.js.tmp <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = 's.p="https://bridge.playgama.com/v2/stable/"'
if s.count(old) != 1:
    sys.exit('public path not found in the bridge: check the patch in tools/update-bridge.sh')
open(p, 'w', encoding='utf-8').write(s.replace(old, 's.p=""'))
EOF
mv playgama-bridge.js.tmp playgama-bridge.js
echo "bridge updated: playgama-bridge.js, platform-bridges/yandex.js"
