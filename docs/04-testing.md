# Shrike 测试策略

## 三层验证结构

Shrike 采用 UT + Lint + E2E 三层验证结构，确保代码质量。

```
┌─────────────────────────────────────────┐
│           E2E (pre-push)                │
│  真实 rsync 执行、Webhook 流程          │
├─────────────────────────────────────────┤
│           Lint (pre-commit)             │
│  Clippy + ESLint                        │
├─────────────────────────────────────────┤
│           UT (pre-commit)               │
│  cargo test + vitest                    │
└─────────────────────────────────────────┘
```

## 测试工具链

| 层级 | 工具 | 目标 | 触发时机 |
| --- | --- | --- | --- |
| Rust UT | `cargo test --lib` | 核心逻辑 95%+ 覆盖 | pre-commit |
| TS UT | `vitest run` | 组件和工具函数 | pre-commit |
| Lint | `clippy -D warnings` + `eslint` | 零警告零错误 | pre-commit |
| Rust E2E | `cargo test --test '*'` | 完整同步和 Webhook 流程 | pre-push |

## Git Hooks 配置

### pre-commit
```bash
bun run test          # vitest (31 个 TS 测试)
bun run test:rs       # cargo test --lib (84 个 Rust UT)
bun run lint          # eslint + clippy
```

### pre-push
```bash
bun run test          # vitest
bun run lint          # eslint + clippy
bun run test:rs       # cargo test --lib
bun run test:e2e:rs   # cargo test --test (12 个 E2E)
```

## 测试分布

### Rust 后端 (96 个测试)

| 模块 | 数量 | 类型 |
| --- | --- | --- |
| types.rs | 10 | UT — 类型构造、序列化、反序列化 |
| error.rs | 4 | UT — 错误显示、序列化、转换 |
| commands.rs | 5 | UT — 路径验证 |
| sync/filelist.rs | 13 | UT — filelist 生成与读取 |
| sync/validation.rs | 23 | UT — 路径验证、批量检查、报告 |
| sync/executor.rs | 16 | UT — rsync 参数构建、输出解析、执行 |
| sync/mod.rs | 4 | UT — 管线集成 |
| webhook.rs | 4 | UT — Token 验证 |
| tests/sync_e2e.rs | 7 | E2E — 真实 rsync 同步 |
| tests/webhook_e2e.rs | 5 | E2E — HTTP 请求流程 |
| **合计** | **91** | |

### TypeScript 前端 (31 个测试)

| 模块 | 数量 | 类型 |
| --- | --- | --- |
| utils.test.ts | 4 | UT — cn() 工具函数 |
| types.test.ts | 3 | UT — 类型结构验证 |
| drop-zone.test.tsx | 4 | 组件 — 拖放交互 |
| file-list.test.tsx | 6 | 组件 — 列表渲染与删除 |
| sync-button.test.tsx | 7 | 组件 — 同步按钮状态 |
| toolbar.test.tsx | 7 | 组件 — 工具栏功能 |
| **合计** | **31** | |

### 总计: **122 个测试**

## 覆盖率目标

- **核心逻辑** (sync 模块): 95%+
- **工具函数** (types, error): 90%+
- **前端组件**: 关键交互路径覆盖
- **E2E**: 主要用户场景覆盖

## 测试命名规范

```
<模块>::tests::<被测函数>_<场景描述>
```

示例:
```
sync::filelist::tests::generate_filelist_unicode_paths
sync::validation::tests::validate_filelist_detects_duplicates
sync::executor::tests::count_transferred_files_skips_dot_and_dotslash
```

## E2E 测试设计原则

1. **真实执行**: 使用真实的 rsync 命令和临时文件
2. **完整验证**: 不仅检查返回值，还验证目标文件内容
3. **边界覆盖**: Unicode 路径、增量同步、内容变更检测
4. **资源清理**: 使用 `tempfile::tempdir()` 自动清理

## 运行命令速查

```bash
# 全部测试
bun run test:all

# 仅 Rust UT
bun run test:rs

# 仅 Rust E2E
bun run test:e2e:rs

# 仅前端测试
bun run test

# 仅 lint
bun run lint

# Clippy 单独运行
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```
