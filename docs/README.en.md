<p align="center">
  <img src="../assets/brand/icon-rounded.png" width="128" height="128" alt="Shrike logo" />
</p>
<h1 align="center">Shrike</h1>
<p align="center">Choose files and folders on a Mac and back them up to Google Drive's local sync directory.</p>
<p align="center"><a href="../README.md">简体中文</a></p>

## What it does

Shrike is a macOS desktop app for backing up selected files, project material, or development tool settings. It uses the system `rsync` command to copy selected content into Google Drive for Desktop's local directory. The Google Drive client then uploads those copies to the cloud.

A completed sync in Shrike means the local copy finished. Check the Google Drive client for cloud upload status.

## Features

- Add files and folders by dragging them into the window or using the native file picker.
- Use Quick Add to find common configuration locations for Claude, Cursor, OpenCode, Windsurf, Copilot, Aider, and VS Code, then choose which entries to include.
- Copy new and changed files with `rsync`, preserve their source directory structure, and use a separate backup subdirectory for each machine.
- Start a sync in the window, or trigger a sync and check status through a local HTTP API protected by a Bearer token.
- Switch between English and Chinese, light and dark themes, menu bar and Dock visibility settings, and optional launch at login.

Backups are copies of the current files. Shrike does not keep version snapshots or provide a restore wizard. Syncs retain old files in the destination, and removing an entry from the list leaves its existing backup intact. Files are copied as-is without additional encryption; check development configurations for credentials before adding them.

## Usage

You need macOS, an available `rsync` command, and [Google Drive for Desktop](https://www.google.com/drive/download/) installed and signed in. See Development below for a source build. [Releases](https://github.com/nocoo/shrike/releases) lists published versions; available installers depend on the attachments for each release.

1. Open Settings and confirm the local Google Drive directory. The app attempts to discover it automatically; check the selected account if you use more than one.
2. Set the backup folder and machine name, then save. The default destination is `<Google Drive directory>/ShrikeBackup/<machine name>/`.
3. Add files or folders and start a sync. Confirm the copies in the destination, then check Google Drive's upload status.

### Local HTTP API

While the app is running, the API listens only on `127.0.0.1`. The default port is `7015` for release builds and `7023` for development. Use the port and token shown in Settings; restart the app after changing the port.

```bash
curl http://127.0.0.1:7015/status \
  -H 'Authorization: Bearer <your-token>'

curl -X POST http://127.0.0.1:7015/sync \
  -H 'Authorization: Bearer <your-token>'
```

Both endpoints require authentication. `POST /sync` waits for the local sync to finish and returns its result. Only one sync runs at a time. An external scheduler can call this endpoint for scheduled backups.

## Development

Install Bun, Node.js (24 or newer is recommended), a Rust toolchain supporting the 2024 edition, and Xcode command line tools. On macOS, run:

```bash
git clone https://github.com/nocoo/shrike.git
cd shrike
bun install --frozen-lockfile
bun run tauri dev
```

Tauri starts the Next.js development server and opens the desktop window. Running `bun run dev` alone serves the frontend; file operations and sync need the Tauri runtime.

```bash
bun run typecheck
bun run lint
bun run tauri build
```

Next.js exports static files to `out/` for Tauri to bundle. Build artifacts are placed under the Cargo workspace's `target/release/` directory.

| Path | Contents |
| --- | --- |
| `src/components/`, `src/hooks/` | File list, settings, and sync interface |
| `src-tauri/src/commands.rs` | Desktop IPC commands |
| `src-tauri/src/sync/` | File lists, path checks, and rsync execution |
| `src-tauri/src/webhook.rs` | Local HTTP API |

Tauri Store saves settings and the backup list in `shrike_data.json` in the app data directory.

## Tests

Install the development dependencies first. Rust integration tests also need the system `rsync` command.

```bash
bun run test
bun run test:rs
bun run test:e2e:rs
```

These run frontend unit and component tests, Rust unit tests, and Rust integration tests respectively. Integration tests copy real files in temporary directories and exercise HTTP handlers through an in-memory Axum router. They do not need a Google Drive login or launch the full desktop interface.

Use `bun run test:all` to run them together. Desktop drag and drop, system tray behavior, and actual Google Drive uploads still need a manual check in the macOS app.

## Stack

| Technology | Role |
| --- | --- |
| Tauri, Rust | Desktop app, file operations, and system integration |
| Next.js, React, TypeScript | Statically exported desktop interface |
| Tailwind CSS, Radix UI | Styling and UI components |
| Tokio, Axum | Local HTTP server |
| rsync | File copying and directory structure preservation |
| Tauri Store | Local settings and backup list |
| Vitest, Testing Library, Cargo test | Frontend and Rust tests |

## Documentation

- [Architecture](02-architecture.md)
- [Sync implementation](../src-tauri/src/sync/)
- [Changelog](../CHANGELOG.md)

## License

[MIT](../LICENSE)
