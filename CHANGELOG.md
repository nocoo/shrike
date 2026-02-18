# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-02-18

### Added
- Tauri v2 + Next.js 16 (SSG) desktop application
- shadcn/ui component library with custom #86502c theme
- Drag-and-drop file/folder addition with full-window overlay
- Native file picker via macOS dialog
- Quick Add wizard to scan and batch-add coding agent configs (.claude, .cursor, .aider, etc.)
- File list management (add, remove, list) with Tauri Store persistence
- Three-layer rsync sync pipeline:
  - `filelist.rs` -- generate `--files-from` temp file
  - `validation.rs` -- validate paths, detect duplicates, check destination
  - `executor.rs` -- build rsync args, execute, parse output
- Incremental sync via `rsync -avR` preserving full directory structure
- Axum webhook server on 127.0.0.1:7022 with Bearer token auth
  - `GET /status` -- current sync status
  - `POST /sync` -- trigger sync
- Settings page with General, Sync, Webhook, and About sections
- Launch at login (autostart) toggle
- Menu bar (tray) icon visibility toggle
- Dock icon visibility toggle via macOS activation policy
- About section with logo, version, and GitHub link
- Application icons generated from logo.png

### Testing
- 186 automated tests (101 Rust UT + 12 Rust E2E + 73 TypeScript)
- Three-layer verification: UT + Lint (pre-commit) + E2E (pre-push)
- Core sync logic coverage: 95%+
