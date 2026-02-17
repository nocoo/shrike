#!/bin/bash
# Generate Tauri app icons and frontend logo from logo.png
# Uses macOS sips (no external dependencies)
# NEVER modifies the source file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE="$PROJECT_DIR/logo.png"
ICONS_DIR="$PROJECT_DIR/src-tauri/icons"
PUBLIC_DIR="$PROJECT_DIR/public"

if [ ! -f "$SOURCE" ]; then
  echo "Error: $SOURCE not found"
  exit 1
fi

echo "Source: $SOURCE ($(sips -g pixelWidth "$SOURCE" 2>/dev/null | tail -1 | awk '{print $2}')px)"

# --- Tauri app icons ---
echo "Generating Tauri icons..."

generate_png() {
  local size=$1
  local output=$2
  cp "$SOURCE" "$output"
  sips -z "$size" "$size" "$output" --out "$output" >/dev/null 2>&1
  echo "  $output (${size}x${size})"
}

generate_png 32 "$ICONS_DIR/32x32.png"
generate_png 64 "$ICONS_DIR/64x64.png"
generate_png 128 "$ICONS_DIR/128x128.png"
generate_png 256 "$ICONS_DIR/128x128@2x.png"
generate_png 512 "$ICONS_DIR/icon.png"

# macOS .icns (use iconutil)
echo "Generating .icns..."
ICONSET_DIR=$(mktemp -d)/Shrike.iconset
mkdir -p "$ICONSET_DIR"
cp "$SOURCE" "$ICONSET_DIR/icon_512x512@2x.png"
sips -z 512 512 "$SOURCE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null 2>&1
sips -z 128 128 "$SOURCE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null 2>&1
sips -z 128 128 "$SOURCE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null 2>&1
sips -z 64 64 "$SOURCE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null 2>&1
sips -z 16 16 "$SOURCE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null 2>&1
iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"
rm -rf "$(dirname "$ICONSET_DIR")"
echo "  $ICONS_DIR/icon.icns"

# Windows .ico (use sips + png2ico workaround via imagemagick if available, otherwise skip)
if command -v magick >/dev/null 2>&1; then
  echo "Generating .ico (via ImageMagick)..."
  magick "$SOURCE" -resize 256x256 -define icon:auto-resize=256,128,64,48,32,16 "$ICONS_DIR/icon.ico"
  echo "  $ICONS_DIR/icon.ico"
else
  echo "Skipping .ico (ImageMagick not found, using existing)"
fi

# --- Frontend logo for toolbar ---
echo "Generating frontend logo..."
mkdir -p "$PUBLIC_DIR"
generate_png 64 "$PUBLIC_DIR/logo-64.png"
generate_png 128 "$PUBLIC_DIR/logo-128.png"

echo "Done!"
