# Shrike logo assets

The original animal is retained byte-for-byte. This Refined pass adds the folded wings background, fine grain, and shallow contact shadows. No image model was called. The transparent foreground keeps its original pose, colors, anatomy, and native canvas.

## Asset roles

| Surface | Asset | Treatment |
| --- | --- | --- |
| README header | `assets/brand/icon-rounded.png` | Selected presentation at 128 px |
| Toolbar | `public/logo-64.png; logo-128.png` | Transparent original; no tile or corner mask |
| About page | `public/logo-512.png` | Rounded presentation shown at 160 px, with no additional CSS crop |
| macOS Dock / bundle | `src-tauri/icons/icon.png; icon.icns; 32x32.png; 64x64.png; 128x128.png; 128x128@2x.png` | Rounded 824 px tile inside a transparent 1024 px canvas; all ICNS scales regenerated |
| Menu bar template | `logo-menu.png; src-tauri/icons/tray-icon.png` | Existing monochrome silhouette retained; native template rendering remains enabled |
| Other packaged platforms | `src-tauri/icons/icon.ico; Square*Logo.png; StoreLogo.png; ios/; android/` | Tauri generator uses the square presentation for platform icons; Android retains separate background and foreground layers with a foreground prepared inside 55% of its canvas |

Root `logo.png` remains the canonical 2048 × 2048 transparent master. `icon.png` and `icon-rounded.png` in this directory are separate square and rounded presentations at the same native dimensions. Small UI marks use the foreground with no external glow, added background, or circular crop. Localized and package READMEs were checked for additional logo headers.

## Reproduce and verify

```sh
uv run --with pillow bash scripts/generate-icons.sh
```

The exact source, sampled palette, independent background layers, every export size, and frozen finishing recipe are archived in `nocoo/hexly.ai` under `artwork/logo-family/shrike/2026-09-07-01/finishing/01`. [source.json](source.json) records provenance and all master SHA-256 values. The separate UI theme palette is unchanged.

- [Individual logo review](https://hexly.ai/logos/shrike)
- [Local static review](https://index.dev.hexly.ai/artwork/logo-family/shrike/2026-09-07-01/review.html)
- [Shared logo usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)

Before/after deliberately shares the same original foreground. Verify small marks at their actual displayed sizes on both themes, decode every ICO resolution, and keep any platform-specific mask separate from the transparent source.
