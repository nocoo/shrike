<p align="center">
  <img src="logo.png" width="128" height="128" alt="Shrike Logo">
</p>

<h1 align="center">Shrike</h1>

<p align="center">
  <strong>Selective file backup to Google Drive</strong>
  <br>
  macOS desktop app powered by Tauri v2 + Next.js + rsync
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.2-blue" alt="Version">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/tests-268%20passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <img src="https://s.zhe.to/dcd0e6e42358/20260218/3263524f-8236-47a1-9fe0-9418f45c4002.jpg" width="380" alt="Shrike Preview">
</p>

---

## What is Shrike?

Shrike is a lightweight macOS app that lets you pick specific files and folders to back up to Google Drive. No full-disk sync, no bloated cloud clients -- just rsync the things you care about.

**How it works:**

1. Drag files onto the window (or click **+** to browse)
2. Hit **Sync** to back them up via rsync
3. Google Drive for Desktop syncs the rest to the cloud

## Features

- **Drag & drop** -- drop files and folders directly onto the window
- **Native file picker** -- click + to browse via macOS dialog
- **Quick Add wizard** -- scan and batch-add coding agent configs (.claude, .cursor, .aider, etc.)
- **Incremental sync** -- rsync only transfers what changed
- **Full path preservation** -- `rsync -avR` keeps your directory structure intact
- **Dark mode** -- auto-detect system preference, or manually choose light/dark
- **i18n** -- English and Chinese UI, auto-detect or manually set
- **Webhook trigger** -- automate backups via `POST http://localhost:7022/sync`
- **Dock & menu bar control** -- hide from Dock and/or menu bar as needed
- **Launch at login** -- optional autostart on macOS login
- **Per-device subfolder** -- separate backup directories via machine name setting

## Install

Download the latest `.dmg` from the [Releases](https://github.com/nocoo/shrike/releases) page, open it, and drag Shrike to Applications.

## Requirements

- macOS (with built-in `rsync` / `openrsync`)
- [Google Drive for Desktop](https://www.google.com/drive/download/) installed and signed in

## Development

```bash
# Clone
git clone https://github.com/nocoo/shrike.git
cd shrike

# Install dependencies (requires Bun + Rust)
bun install

# Run in dev mode
bun run tauri dev

# Build for release
bun run tauri build
```

## Webhook API

Trigger syncs programmatically from scripts, cron jobs, or automation tools:

```bash
# Trigger a sync
curl -X POST http://localhost:7022/sync \
  -H "Authorization: Bearer <your-token>"

# Check status
curl http://localhost:7022/status \
  -H "Authorization: Bearer <your-token>"
```

The token is auto-generated on first launch. Find it in **Settings** (gear icon).

## Architecture

```
Frontend (Next.js + shadcn/ui)
    |
    | Tauri IPC
    v
Backend (Rust)
    |
    |  sync pipeline: filelist -> validation -> rsync execution
    v
macOS rsync -> Google Drive (local mount)
```

## Testing

268 automated tests across three layers:

| Layer | Tool | Count |
| ----- | ---- | ----- |
| Rust UT | `cargo test` | 109 |
| Rust E2E | `cargo test --tests` | 12 |
| TS UT/Component | `vitest` | 147 |

```bash
# Run everything
bun run test:all

# Just Rust
bun run test:rs

# Just frontend
bun run test

# Lint (clippy + eslint)
bun run lint
```

## Project Structure

```
shrike/
├── src/                    # Next.js frontend
│   ├── components/         # UI components (shadcn/ui based)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Types, utils, i18n, Tauri command wrappers
│   └── test/               # Test utilities (renderWithLocale)
├── src-tauri/
│   ├── src/
│   │   ├── sync/           # Three-layer sync pipeline
│   │   │   ├── filelist.rs    # Generate --files-from temp file
│   │   │   ├── validation.rs  # Validate paths and destination
│   │   │   └── executor.rs    # Build args, run rsync, parse output
│   │   ├── commands.rs     # Tauri IPC commands
│   │   ├── webhook.rs      # Axum HTTP server
│   │   ├── types.rs        # Shared data types
│   │   └── error.rs        # Error definitions
│   └── tests/              # E2E integration tests
└── CHANGELOG.md
```

## License

[MIT](LICENSE)
