#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_FILE="$ROOT_DIR/MadiniArchive.spec"
PYINSTALLER_CONFIG_DIR="$ROOT_DIR/.pyinstaller"
APP_NAME="Madini Archive"
DIST_DIR="$ROOT_DIR/dist/$APP_NAME"
WORK_DIR="$ROOT_DIR/build/$APP_NAME"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
ZIP_PATH="$DIST_DIR/$APP_NAME-macOS.zip"

mkdir -p "$DIST_DIR" "$WORK_DIR" "$PYINSTALLER_CONFIG_DIR"

export PYINSTALLER_CONFIG_DIR
python3 -m PyInstaller \
  --clean \
  --noconfirm \
  --distpath "$DIST_DIR" \
  --workpath "$WORK_DIR" \
  "$SPEC_FILE"

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "Build failed: $APP_BUNDLE was not created." >&2
  exit 1
fi

rm -f "$ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE" "$ZIP_PATH"

echo "App bundle: $APP_BUNDLE"
echo "Zip archive: $ZIP_PATH"
