# 原生实现约束

Detailed project constraints and procedures. The root [AGENTS.md](../AGENTS.md) defines the quality contract and records current enforcement gaps.

## Architecture Notes

### Sync pipeline (three layers)

```
sync/filelist.rs    → Generate --files-from temp file
sync/validation.rs  → Validate paths, check destination
sync/executor.rs    → Build rsync args, run, parse output
sync/mod.rs         → Orchestrate: generate → validate → execute
```

### Key API paths

- `commands.rs` → Tauri IPC: add_entry, remove_entry, list_entries, get_settings, update_settings, trigger_sync, scan_coding_configs, scan_coding_configs_tree
- `webhook.rs` → HTTP: GET /status, POST /sync (both require Bearer token)

### i18n system (self-built, zero dependencies)

```
src/lib/i18n.tsx       → Translation dicts (en/zh, 75+ keys), LocaleProvider, useLocale hook
src/app/providers.tsx  → Client component wrapping ThemeProvider + LocaleProvider
src/test/test-utils.tsx → renderWithLocale() test helper
```

- `resolveLocale("auto")` → detects via `navigator.language`, falls back to `"en"` in test env
- Pluralization helpers: `pluralizeItems`, `pluralizeFiles`, `pluralizeDirs`, `formatSynced`, `formatAddToSyncList`, `formatInstalledCli`, `formatDialogTitle`
- `formatHeader(result, error, t, locale)` — shared by sync-log and sync-summary

### Theme system (next-themes)

- `next-themes` ThemeProvider with `attribute="class"` in `providers.tsx`
- CSS dark mode already in `globals.css`: `:root` (light) + `.dark` (dark) variable blocks
- Tailwind v4 dark variant: `@custom-variant dark (&:is(.dark *));`
- Settings maps `"auto"` → next-themes `"system"`

### AppSettings (10 fields)

When adding a field, update ALL fixtures: `types.rs` (2), `sync/mod.rs` (1), `sync_e2e.rs` (1), `webhook_e2e.rs` (2), `types.test.ts` (1), `settings-page.test.tsx` (1)

## Known Issues & Gotchas

- macOS ships `openrsync` (protocol 29) — `--files-from` and `-R` work correctly
- Google Drive path contains Chinese chars — Rust handles UTF-8 fine
- `tauri::async_runtime::spawn` must be used instead of `tokio::spawn` in Tauri setup
- macOS openrsync in verbose mode outputs directory lines too — tests account for this
- Before development, inspect port 3000 and `.next/dev/lock`; stop only your own verified development process before removing its stale lock.
- `next/image` with SSG requires `images: { unoptimized: true }`
- ESLint flat config lacks `@next/next/no-img-element` rule — don't eslint-disable it
