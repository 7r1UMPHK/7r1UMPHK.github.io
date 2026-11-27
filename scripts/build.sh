#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
GMEEK_DIR=${GMEEK_DIR:-"$ROOT/.gmeek-build"}

: "${GITHUB_TOKEN:?set GITHUB_TOKEN}"
: "${GITHUB_REPOSITORY:?set GITHUB_REPOSITORY}"

GMEEK_REPO=$(python3 -c 'import json;print(json.load(open("config.json")).get("GMEEK_REPO","https://github.com/7r1UMPHK/Gmeek.git"))' )
GMEEK_VERSION=$(python3 -c 'import json;print(json.load(open("config.json"))["GMEEK_VERSION"])')

if [ ! -d "$GMEEK_DIR/.git" ]; then
  git clone "$GMEEK_REPO" "$GMEEK_DIR"
fi
git -C "$GMEEK_DIR" fetch --tags --quiet
git -C "$GMEEK_DIR" checkout --quiet "$GMEEK_VERSION"

cp -r "$ROOT/config.json" "$ROOT/static" "$ROOT/scripts" "$GMEEK_DIR"/

cd "$GMEEK_DIR"
python3 Gmeek.py "$GITHUB_TOKEN" "$GITHUB_REPOSITORY"

rm -rf "$ROOT/docs"
cp -a "$GMEEK_DIR/docs" "$ROOT/docs"
cp -a "$GMEEK_DIR/backup" "$ROOT/backup"
cp "$GMEEK_DIR/blogBase.json" "$ROOT/blogBase.json"

echo "build done: $ROOT/docs"
