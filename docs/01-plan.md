# Shrike - Selective File Backup to Google Drive

> Tauri v2 + Next.js (SSG) + shadcn/ui + Rsync

## Architecture

```
Frontend (UI)         Middle Layer (Logic)         Execution Layer (Core)
Next.js + shadcn/ui   Tauri Commands + Store       macOS rsync
                      Axum Webhook Server          Google Drive (local mount)
```

## Tech Stack

| Module            | Choice                 | Rationale                                          |
| ----------------- | ---------------------- | -------------------------------------------------- |
| App Framework     | Tauri v2               | Lightweight, native file drop support              |
| Frontend          | Next.js (SSG)          | Static export, familiar stack                      |
| UI Components     | shadcn/ui              | High quality, accessible, customizable             |
| Data Persistence  | Tauri Store Plugin     | Auto-managed JSON in app_data_dir                  |
| Sync Engine       | rsync -avR             | System native, incremental, preserves dir structure |
| Cloud Storage     | Google Drive for Desktop | Mounted as local volume                          |
| Webhook           | Rust Axum              | Embedded HTTP server on 127.0.0.1:18888            |
| Package Manager   | bun                    | Fast, modern                                       |

## Project Structure

```
shrike/
├── src/                          # Next.js frontend (SSG)
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── file-list.tsx
│   │   ├── drop-zone.tsx
│   │   ├── sync-button.tsx
│   │   ├── sync-log.tsx
│   │   └── settings-dialog.tsx
│   ├── lib/
│   │   ├── store.ts
│   │   ├── commands.ts
│   │   └── types.ts
│   └── hooks/
│       ├── use-file-list.ts
│       └── use-sync.ts
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs
│   │   ├── commands.rs
│   │   ├── sync.rs
│   │   ├── webhook.rs
│   │   └── error.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
├── tests/                        # E2E tests
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## Data Schema (Tauri Store)

```json
{
  "items": [
    {
      "id": "uuid",
      "path": "/Users/nocoo/.zshrc",
      "item_type": "file",
      "added_at": "2026-02-18T00:00:00Z",
      "last_synced": null
    }
  ],
  "settings": {
    "gdrive_path": "/Users/nocoo/Library/CloudStorage/GoogleDrive-user@example.com/\u6211\u7684\u4e91\u7aef\u786c\u76df",
    "backup_dir_name": "ShrikeBackup",
    "webhook_port": 18888,
    "webhook_token": "generated-uuid-token"
  }
}
```

## Testing Strategy

| Layer | Tool                        | Scope                                    | Trigger      |
| ----- | --------------------------- | ---------------------------------------- | ------------ |
| UT    | `cargo test` + `bun test`   | Core functions, path validation, CRUD    | `pre-commit` |
| Lint  | `clippy` + `eslint`         | Code quality                             | `pre-commit` |
| E2E   | `cargo test` (integration)  | Full sync workflow, webhook trigger      | `pre-push`   |

## Implementation Phases

### Phase 0: Scaffolding

- [x] 0.0 Write plan document
- [x] 0.1 Scaffold Tauri v2 + Next.js project
- [x] 0.2 Configure shadcn/ui and Tailwind
- [x] 0.3 Setup testing and linting infra

### Phase 1: Data Layer (Rust Backend)

- [x] 1.1 Add backup item types and store schema
- [x] 1.2 Implement file list management commands
- [x] 1.3 Implement path validation
- [x] 1.4 Implement rsync command builder
- [x] 1.5 Implement sync executor with streaming output

### Phase 2: Frontend UI

- [x] 2.1 Implement drop zone with drag-drop events
- [x] 2.2 Implement file list with remove and badge
- [x] 2.3 Implement sync button with progress log
- [x] 2.4 Implement settings dialog for gdrive path

### Phase 3: Webhook

- [x] 3.1 Add Axum webhook server on localhost:18888
- [x] 3.2 Add webhook auth with bearer token

### Phase 4: Polish

- [ ] 4.1 Add E2E tests for full sync workflow
- [ ] 4.2 Add README with usage instructions

## Key Technical Decisions

### Rsync Command

```bash
rsync -avR --files-from=/tmp/shrike_backup_list.txt / "$GDRIVE_PATH/ShrikeBackup/"
```

- `-a`: Archive mode (preserve attributes)
- `-v`: Verbose output
- `-R`: Relative paths (preserves full directory structure)
- `--files-from`: Read file list from generated temp file
- Source `/` combined with absolute paths in files-from

### Google Drive Mount Path

```
/Users/nocoo/Library/CloudStorage/GoogleDrive-user@example.com/\u6211\u7684\u4e91\u7aef\u786c\u76df/ShrikeBackup/
```

### Webhook API

```bash
# Trigger sync
curl -X POST http://localhost:18888/sync -H "Authorization: Bearer <token>"

# Check status
curl http://localhost:18888/status -H "Authorization: Bearer <token>"
```

### Security

- Webhook bound to 127.0.0.1 only (not exposed externally)
- Bearer token authentication
- Tauri shell permissions scoped to rsync and mkdir only
- No `--delete` flag on rsync (deleted files preserved in backup)
