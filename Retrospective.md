# Retrospective

Accident narratives belong here. Keep only recurring project rules in `AGENTS.md`; cross-project lessons belong in global rules and deterministic checks in hooks/tests.

## Undated migrated entries

1. **Tauri v2 window dragging requires THREE things** — Initially thought `data-tauri-drag-region` alone was enough. Dragging silently failed until we also added (1) CSS `app-region: drag` rule targeting `[data-tauri-drag-region]`, and (2) `core:window:allow-start-dragging` permission in `capabilities/default.json`. Silent failure made debugging hard — always check all three.

2. **`data-tauri-drag-region` doesn't propagate to children** — Child elements (buttons, icons) inside a drag-region element don't inherit the drag behavior. Conversely, they need explicit `app-region: no-drag` CSS to remain clickable, otherwise they might trigger window drag instead of their click handlers.

3. **Next.js 16 Server Components cannot have event handlers** — Attempted to add `onContextMenu` handler in `layout.tsx` (a Server Component), which caused a build error. Event handlers must go on Client Components (`"use client"`). Moved the handler to `page.tsx` instead.

4. **Always verify TS test count after adding component tests** — The test count in CLAUDE.md said 31 TS tests but the actual count was 33 after toolbar drag-region tests were added. Keep the count accurate to avoid confusion.

5. **Testing Library query is `getByAltText`, not `getByAlt`** — The correct RTL query for finding elements by `alt` attribute is `screen.getByAltText("...")`. `getByAlt` does not exist and throws a TypeError at runtime.

6. **Radix Collapsible content is NOT in the DOM when closed** — Tests that query for child elements inside a `<CollapsiblePrimitive.Content>` will fail if the collapsible is in its default closed state. Must programmatically click the trigger button to expand before asserting on children. This affects both `getByText` and `getAllByRole("checkbox")` counts.

7. **Smart folding requires marking children as added too** — When `computePathsToAdd()` folds all children into a parent directory path and `addEntry(parentPath)` succeeds, the `added` map must also mark each child path as added. Otherwise `allAdded` (which checks selectable child paths) never becomes true, and the "Done" button never appears.

8. **rsync `--files-from` disables implicit recursion** — Even though `-a` includes `-r`, using `--files-from` turns off recursive directory traversal. Directory entries in the filelist are created as empty directories. Must add explicit `-r` flag (i.e. `-avrR`) to restore recursion. This is a documented rsync behavior but easy to miss since `-a` normally implies `-r`.

9. **Never hardcode version strings in UI** — About page had `"v0.1.0"` hardcoded, which went stale when we released v0.1.1. The test also hardcoded the same string, so it passed despite the mismatch. Use `getVersion()` from `@tauri-apps/api/app` which reads from `tauri.conf.json` at runtime — single source of truth.

10. **macOS `set_activation_policy(Accessory)` hides all windows** — Toggling dock visibility via `NSApplication.setActivationPolicy` to `Accessory` removes the dock icon but also hides all app windows as a side effect. Must explicitly call `window.show()` + `window.set_focus()` after the policy change. Additionally, switching back to `Regular` shows a generic icon — must call `NSApplication.setApplicationIconImage:` with the bundled icon to restore it. Use `objc2` crate (not deprecated `cocoa` crate).

11. **Use trait abstraction to test Tauri handlers without a runtime** — Webhook handlers depended on `AppHandle` for store access, making real HTTP integration tests impossible without a full Tauri runtime. Solution: extract a `DataStore` trait with `load_settings()` / `load_items()`, make handlers generic over `S: DataStore`, and expose `build_router<S>()`. Tests use a `MockStore` impl + `tower::ServiceExt::oneshot()` to send real HTTP requests through the axum router — no TCP binding or Tauri runtime needed.
