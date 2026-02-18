# Shrike - Project Context

## Quick Reference

- **Package manager**: `bun` (not npm/pnpm)
- **Dev command**: `bun run tauri dev`
- **Rust edition**: 2024 (resolver = "3")
- **Port**: Webhook on 127.0.0.1:7022
- **Google Drive path**: Auto-detected from `~/Library/CloudStorage/GoogleDrive-*/`

## Version Management

### Current version: 0.1.1

Version is tracked in three files (keep in sync):
- `package.json` → `"version": "0.1.1"`
- `src-tauri/Cargo.toml` → `version = "0.1.1"`
- `src-tauri/tauri.conf.json` → `"version": "0.1.1"`

### Release process
1. Update version in all three files
2. Update `CHANGELOG.md`
3. `git commit -m "chore: release v<version>"`
4. `git tag -a v<version> -m "v<version>"`
5. `git push origin main --tags`
6. `gh release create v<version> --title "v<version>"`

### Commit convention
Conventional Commits: `<type>: <description>`
Types: feat, fix, docs, test, refactor, chore
Rules: imperative mood, lowercase, max 50 chars, no period

## Testing

### Test commands
```bash
bun run test          # vitest (frontend, 143 tests)
bun run test:rs       # cargo test --lib (rust UT, 109 tests)
bun run test:e2e:rs   # cargo test --tests (rust E2E, 12 tests)
bun run test:all      # all of the above
bun run lint          # eslint + clippy
```

### Git hooks (husky)
- **pre-commit**: `bun run test && bun run test:rs && bun run lint`
- **pre-push**: `bun run test && bun run lint && bun run test:rs && bun run test:e2e:rs`

### Test distribution
- Rust UT: 109 (types 12, error 4, commands 5, sync/filelist 13, sync/validation 23, sync/executor 16, sync/mod 4, webhook 4, sync status 5, gdrive detect 8, scan configs 7, scan tree 8)
- Rust E2E: 12 (sync_e2e 7, webhook_e2e 5)
- TS: 143 (utils 4, types 4, components 135)
- **Total: 264**

### Coverage target
- Core sync logic: 95%+
- Overall: 90%+

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

## Known Issues & Gotchas

- macOS ships `openrsync` (protocol 29) — `--files-from` and `-R` work correctly
- Google Drive path contains Chinese chars — Rust handles UTF-8 fine
- `tauri::async_runtime::spawn` must be used instead of `tokio::spawn` in Tauri setup
- macOS openrsync in verbose mode outputs directory lines too — tests account for this
- Port conflicts: `lsof -ti:3000 | xargs kill -9` and `rm -f .next/dev/lock` before dev
- `next/image` with SSG requires `images: { unoptimized: true }`
- ESLint flat config lacks `@next/next/no-img-element` rule — don't eslint-disable it

## Retrospective

1. **Tauri v2 window dragging requires THREE things** — Initially thought `data-tauri-drag-region` alone was enough. Dragging silently failed until we also added (1) CSS `app-region: drag` rule targeting `[data-tauri-drag-region]`, and (2) `core:window:allow-start-dragging` permission in `capabilities/default.json`. Silent failure made debugging hard — always check all three.

2. **`data-tauri-drag-region` doesn't propagate to children** — Child elements (buttons, icons) inside a drag-region element don't inherit the drag behavior. Conversely, they need explicit `app-region: no-drag` CSS to remain clickable, otherwise they might trigger window drag instead of their click handlers.

3. **Next.js 16 Server Components cannot have event handlers** — Attempted to add `onContextMenu` handler in `layout.tsx` (a Server Component), which caused a build error. Event handlers must go on Client Components (`"use client"`). Moved the handler to `page.tsx` instead.

4. **Always verify TS test count after adding component tests** — The test count in CLAUDE.md said 31 TS tests but the actual count was 33 after toolbar drag-region tests were added. Keep the count accurate to avoid confusion.

5. **Testing Library query is `getByAltText`, not `getByAlt`** — The correct RTL query for finding elements by `alt` attribute is `screen.getByAltText("...")`. `getByAlt` does not exist and throws a TypeError at runtime.

6. **Radix Collapsible content is NOT in the DOM when closed** — Tests that query for child elements inside a `<CollapsiblePrimitive.Content>` will fail if the collapsible is in its default closed state. Must programmatically click the trigger button to expand before asserting on children. This affects both `getByText` and `getAllByRole("checkbox")` counts.

7. **Smart folding requires marking children as added too** — When `computePathsToAdd()` folds all children into a parent directory path and `addEntry(parentPath)` succeeds, the `added` map must also mark each child path as added. Otherwise `allAdded` (which checks selectable child paths) never becomes true, and the "Done" button never appears.

8. **rsync `--files-from` disables implicit recursion** — Even though `-a` includes `-r`, using `--files-from` turns off recursive directory traversal. Directory entries in the filelist are created as empty directories. Must add explicit `-r` flag (i.e. `-avrR`) to restore recursion. This is a documented rsync behavior but easy to miss since `-a` normally implies `-r`.
