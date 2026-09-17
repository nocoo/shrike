# Shrike

Selective file backup to Google Drive for Desktop using local rsync.
Profile: native-hybrid.
Direction: [architecture](docs/02-architecture.md). Frameworks must preserve this handbook.

## Sources of Truth

This file is the quality contract; hooks, CI and config are enforcement. Close implementation gaps without lowering the contract. Historical test results are not evidence of a current passing run.

| Fact | Where |
|---|---|
| Human docs / sync rules | [README.md](README.md), [sync pipeline](docs/03-sync-pipeline.md) |
| Detailed implementation | [native constraints](docs/06-native-implementation.md) |
| Version | synchronize `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| Enforcement | `.husky`, `vitest.config.ts`, Cargo, ESLint and CI |
| Accidents | [Retrospective.md](Retrospective.md) |
| Machine workflow | global `AGENTS.md` and Git rules |

## Project Invariants

- Sync means local rsync completion, not completed cloud upload. Preserve source hierarchy; do not delete destination backups when removing an entry.
- Validate paths and the chosen Google Drive account/destination before copying; files are not additionally encrypted.
- Only loopback GET /status and POST /sync are exposed, both Bearer-authenticated; run one sync at a time.
- Use `tauri::async_runtime::spawn` in setup and explicit rsync `-r` with `--files-from`; preserve filelist → validation → execution boundaries.
- Keep i18n/theme/fixture updates coherent when settings fields change; preserve native drag regions and Dock visibility restoration.
- Keep all three version files synchronized and read runtime UI version through Tauri; never hardcode release text.

## Stack / Layout

| Lane | Location / choice |
|---|---|
| Frontend | `src`, Next.js static export / React, Bun |
| Native / webhook | `src-tauri`, Rust 2024 / resolver 3, Tauri v2, Axum |
| Data / backup | Tauri Store `shrike_data.json`, system rsync, local Google Drive directory |
| Test lanes | Vitest plus Rust unit and sync/webhook integration suites |

## Commands

Run at root with Bun, Node 24+, Rust 2024-capable tools and Xcode CLT. Rust integration tests need system rsync, but do not require Google Drive login. Pre-push additionally requires cargo-llvm-cov and OSV; pre-commit requires gitleaks.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:check
bun run build
bun run test:coverage
bun run test:rs
bun run test:e2e:rs
bun run tauri dev
```

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1 (test isolation). Status: `enforced`, `planned`, `manual`, or `N/A`; partial enforcement below does not certify the full required bar.
L1 requires statements, branches, functions and lines each ≥95%, with no skipped/focused tests; preserve any stricter package threshold. Native tools must identify unmeasured metrics as gaps.
G1 requires check-only strict analysis/formatting with zero errors/warnings. G2 requires dependency and secret scans, with missing required scanners failing.

| Dimension | Status | Required proof and current evidence/gap |
|---|---|---|
| L1 TypeScript | planned | Four 95% thresholds run in hook/CI, but `passWithNoTests` and UI/script exclusions leave coverage/completeness gaps. |
| L1 Rust | planned | Hook runs llvm-cov with lines ≥80%; no all-four ≥95% gate. |
| L2 sync / webhook | planned | Real rsync uses temp directories; Axum `oneshot` tests are in-memory router calls, not TCP HTTP. Add real-loopback coverage of both endpoint/method pairs. |
| L3 native UI | manual | Check drag/drop, tray, Dock, themes and actual Google Drive upload separately on macOS. |
| G1 TS / Rust | planned | Hook/CI run TS checks, zero-warning ESLint and clippy; Prettier check exists but is not part of those gates. |
| G2 | enforced | CI scans both bun.lock and Cargo.lock plus secrets; local hooks split gitleaks and Cargo OSV. |
| D1 | planned | Rust temp-directory/mock-store tests avoid daily backup data; explicit destructive-operation markers/guards across all lanes are not established. |

Husky pre-commit runs types/lint/TS coverage/Rust units/secrets. Pre-push repeats checks, runs 80%-line Rust coverage and integration, then OSV. CI builds the web output and runs both language lanes. Hooks use the working tree.

Target hooks: pre-commit checks G1 + L1 against the index snapshot (`git checkout-index`) in <30s; pre-push checks L2 and G2 in parallel against every stdin push ref/commit in <3min, plus build where applicable. L3 runs in CI or an explicit manual lane.
Never bypass commit/push hooks, force-push, or use autofix in checks. Documentation changes do not authorize deploying or implementing new gates.

## Resources / Isolation

Release webhook defaults to 7015; development uses 7023 on 127.0.0.1. Tests must use per-run temporary trees and no real Google Drive directory. Never send POST /sync to the everyday app during documentation checks.

## Operations / Release

Follow [versioning](docs/05-versioning.md). `bun run tauri build` packages the frontend export and native app only when needed; publication requires current release authorization. Use lowercase Conventional Commits, imperative subject, ≤50 characters, no final period.

## Retrospective

Move accident narratives to [Retrospective.md](Retrospective.md); keep at most about ten concise recurring project rules here. Put architecture and operational detail in linked docs.

- Preserve all three pieces of window dragging and explicit no-drag children.
- Router oneshot calls do not establish real HTTP acceptance.
- Keep explicit rsync recursion with file lists.
