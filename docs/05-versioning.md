# Shrike 版本管理

## 版本规范

Shrike 遵循 [Semantic Versioning 2.0.0](https://semver.org/) (语义化版本):

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: 不兼容的 API 变更
- **MINOR**: 向后兼容的新功能
- **PATCH**: 向后兼容的问题修复

## 版本同步位置

版本号在以下文件中保持同步:

| 文件 | 字段 | 示例 |
| --- | --- | --- |
| `src-tauri/Cargo.toml` | `version` | `"0.1.0"` |
| `src-tauri/tauri.conf.json` | `version` | `"0.1.0"` |
| `package.json` | `version` | `"0.1.0"` |
| `CHANGELOG.md` | 章节标题 | `## [0.1.0]` |

## 发版流程

### 1. 更新版本号

在以上三个配置文件中同步更新版本号。

### 2. 更新 CHANGELOG

在 `CHANGELOG.md` 中添加新版本的变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/) 格式:

```markdown
## [0.2.0] - 2026-02-20

### Added
- 新功能描述

### Changed
- 变更描述

### Fixed
- 修复描述
```

### 3. 提交与打标签

```bash
git add -A
git commit -m "chore: release v0.2.0"
git tag -a v0.2.0 -m "v0.2.0"
```

### 4. 推送

```bash
git push origin main --tags
```

### 5. GitHub Release

```bash
gh release create v0.2.0 --title "v0.2.0" --notes-file CHANGELOG_EXCERPT.md
```

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

### 类型

| 类型 | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 问题修复 |
| `docs` | 文档变更 |
| `test` | 测试变更 |
| `refactor` | 代码重构（非功能/修复） |
| `chore` | 构建/工具变更 |

### 规则
- 祈使句语气 (如 `fix: ignore...`)
- 全小写
- 限 50 字符以内
- 不加句号

## 版本历史

### v0.1.0 (2026-02-18)

首个版本，包含完整的核心功能:

- Tauri v2 + Next.js (SSG) 桌面应用
- 拖放和文件选择器添加备份项
- rsync 增量同步到 Google Drive
- 三层同步管线 (filelist → validation → executor)
- Axum Webhook 服务器 (localhost:18888)
- Bearer Token 认证
- 122 个自动化测试
