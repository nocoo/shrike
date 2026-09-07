#!/bin/bash
# Run with: uv run --with pillow bash scripts/generate-icons.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
python3 scripts/resize-logos.py --android-source
bun x tauri icon assets/brand/tauri-icons.json --output src-tauri/icons
python3 scripts/resize-logos.py
