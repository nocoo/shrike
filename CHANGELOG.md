# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-02-18

### Added
- Tauri v2 + Next.js (SSG) desktop application scaffold
- shadcn/ui component library with custom #86502c theme
- Drag-and-drop file/folder addition with full-window overlay
- Native file picker via macOS dialog
- File list management (add, remove, list) with Tauri Store persistence
- Three-layer rsync sync pipeline:
  - `filelist.rs` — generate `--files-from` temp file
  - `validation.rs` — validate paths, detect duplicates, check destination
  - `executor.rs` — build rsync args, execute, parse output
- Incremental sync via `rsync -avR` preserving full directory structure
- Axum webhook server on 127.0.0.1:7022 with Bearer token auth
  - `GET /status` — current sync status
  - `POST /sync` — trigger sync
- Application icons generated from logo.png
- Settings dialog with center fade+zoom animation
- Toolbar with logo, title, entry count, add button, settings gear

### Testing
- 127 automated tests (84 Rust UT + 12 Rust E2E + 31 TypeScript)
- Three-layer verification: UT (pre-commit) + Lint (pre-commit) + E2E (pre-push)
- Core sync logic coverage: 95%+

### Documentation
- Chinese documentation series (architecture, sync pipeline, testing, versioning)
- README with project overview and usage guide
- CLAUDE.md with version management and testing methodology
