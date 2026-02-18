# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-02-18

### Added
- Dark theme support with system preference auto-detection (auto/light/dark)
- i18n support with Chinese and English UI (auto/zh/en)
- Appearance section in Settings with theme and language selectors
- Lightweight i18n system: translation dicts + React Context + useLocale hook
- next-themes integration for theme switching with class-based dark mode

### Changed
- All hardcoded UI strings replaced with i18n translation keys
- About page version now reads dynamically from Tauri API

### Testing
- 268 automated tests (109 Rust UT + 12 Rust E2E + 147 TypeScript)
- renderWithLocale test helper for i18n-aware component testing

## [0.1.1] - 2026-02-18

### Added
- Dropdown menu on + button for separate "Add Files" / "Add Folders" selection
- Standalone About page with logo, version, and GitHub link
- Sync log as dedicated page with formatted summary
- Separate file and directory counts in sync results
- File list entries grouped by directory with full-path headers
- Quick Add wizard redesigned with collapsible file tree and smart folding
- Per-device backup subfolder via machine name setting

### Fixed
- Sync no longer blocks the UI (trigger_sync made async with spawn_blocking)
- rsync directory recursion restored with explicit `-r` flag when using `--files-from`
- File list refreshes when navigating back from wizard
- Checkbox checked prop always boolean to avoid React warning
- Scrollbar thumb visibility improved
- About page logo upgraded to higher resolution (160x160)
- Shell permission added for opening external links

### Testing
- 264 automated tests (109 Rust UT + 12 Rust E2E + 143 TypeScript)
- Added `@testing-library/user-event` for Radix portal testing

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
