#!/usr/bin/env python3
"""Finish macOS and UI derivatives after Tauri generates the platform icon sets."""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri/icons"


def main():
    foreground = Image.open(ROOT / "logo.png").convert("RGBA")
    rounded = Image.open(ROOT / "assets/brand/icon-rounded.png").convert("RGBA")
    if "--android-source" in sys.argv:
        for source, name in [(foreground, "android-foreground.png"), (Image.open(ROOT / "logo-menu.png").convert("RGBA"), "android-monochrome.png")]:
            inset = Image.new("RGBA", (2048, 2048))
            mark = source.copy()
            mark.thumbnail((1126, 1126), Image.Resampling.LANCZOS)
            inset.alpha_composite(mark, ((2048 - mark.width) // 2, (2048 - mark.height) // 2))
            inset.save(ROOT / "assets/brand" / name)
        return
    for size in (64, 128):
        foreground.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / f"public/logo-{size}.png")
    rounded.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / "public/logo-512.png")

    # The Dock uses these exact PNGs and ICNS; macOS requires its own inset and mask.
    native = Image.new("RGBA", (1024, 1024))
    native.alpha_composite(rounded.resize((824, 824), Image.Resampling.LANCZOS), (100, 100))
    for size, filename in [(32, "32x32.png"), (64, "64x64.png"), (128, "128x128.png"), (256, "128x128@2x.png"), (512, "icon.png")]:
        native.resize((size, size), Image.Resampling.LANCZOS).save(ICONS / filename)
    with tempfile.TemporaryDirectory(prefix="shrike-icons-") as temporary:
        iconset = Path(temporary) / "Shrike.iconset"
        iconset.mkdir()
        for logical in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                suffix = "@2x" if scale == 2 else ""
                size = logical * scale
                native.resize((size, size), Image.Resampling.LANCZOS).save(iconset / f"icon_{logical}x{logical}{suffix}.png")
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS / "icon.icns")], check=True)
    print("Generated transparent toolbar marks, About presentation, and inset macOS icons; tray template retained.")


if __name__ == "__main__":
    main()
