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
  <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/tests-127%20passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
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
- **Incremental sync** -- rsync only transfers what changed
- **Full path preservation** -- `rsync -avR` keeps your directory structure intact
- **Webhook trigger** -- automate backups via `POST http://localhost:18888/sync`
- **Portable data** -- settings stored in a single JSON file

## Requirements

- macOS (with built-in `rsync` / `openrsync`)
- [Google Drive for Desktop](https://www.google.com/drive/download/) installed and signed in
- [Bun](https://bun.sh/) (for development)
- [Rust](https://rustup.rs/) (for development)

## Quick Start

```bash
# Clone
git clone https://github.com/nocoo/shrike.git
cd shrike

# Install dependencies
bun install

# Run in dev mode
bun run tauri dev
```

## Webhook API

Trigger syncs programmatically from scripts, cron jobs, or automation tools:

```bash
# Trigger a sync
curl -X POST http://localhost:18888/sync \
  -H "Authorization: Bearer <your-token>"

# Check status
curl http://localhost:18888/status \
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

See [docs/02-architecture.md](docs/02-architecture.md) for details.

## Testing

127 automated tests across three layers:

| Layer | Tool | Count |
| ----- | ---- | ----- |
| Rust UT | `cargo test` | 84 |
| Rust E2E | `cargo test --tests` | 12 |
| TS UT/Component | `vitest` | 31 |

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
│   ├── hooks/              # React hooks
│   └── lib/                # Types, utils, Tauri command wrappers
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
└── docs/                   # Documentation (Chinese)
```

## Documentation

| Doc | Content |
| --- | ------- |
| [01-plan.md](docs/01-plan.md) | Project plan and progress |
| [02-architecture.md](docs/02-architecture.md) | Architecture overview |
| [03-sync-pipeline.md](docs/03-sync-pipeline.md) | Sync pipeline design |
| [04-testing.md](docs/04-testing.md) | Testing strategy |
| [05-versioning.md](docs/05-versioning.md) | Version management |

## License

MIT
