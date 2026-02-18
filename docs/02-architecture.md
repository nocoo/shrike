# Shrike 架构文档

## 概述

Shrike 是一个 macOS 桌面应用，用于将选定的文件和文件夹增量备份到 Google Drive。用户通过拖拽或文件选择器管理备份列表，手动触发或通过 Webhook 触发 rsync 同步。

## 技术栈

| 模块         | 技术方案               | 选型理由                             |
| ------------ | ---------------------- | ------------------------------------ |
| 应用框架     | Tauri v2               | 轻量级、原生文件拖放支持             |
| 前端         | Next.js (SSG)          | 静态导出、React 生态                 |
| UI 组件      | shadcn/ui              | 高质量、可定制、无障碍               |
| 数据持久化   | Tauri Store Plugin     | 自动管理的 JSON 存储                 |
| 同步引擎     | rsync -avR             | 系统原生、增量同步、保留目录结构     |
| 云存储       | Google Drive for Desktop | 本地挂载卷                         |
| Webhook | Rust Axum | 嵌入式 HTTP 服务器 (127.0.0.1:7022) |
| 包管理器     | bun                    | 快速、现代                           |

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js + shadcn/ui)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ toolbar  │  │ drop-zone│  │ file-list│  │ sync-btn  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│  ┌──────────────────┐  ┌─────────────────────────────────┐ │
│  │ use-file-list.ts │  │ use-sync.ts                     │ │
│  └──────────────────┘  └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Tauri IPC Bridge                         │
├─────────────────────────────────────────────────────────────┤
│                    Backend (Rust)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ commands.rs — Tauri 命令 (add/remove/list/sync)      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ sync/ — 三层同步管线                                  │  │
│  │  ├── filelist.rs   — Layer 1: 文件列表生成            │  │
│  │  ├── validation.rs — Layer 2: 路径验证               │  │
│  │  └── executor.rs   — Layer 3: rsync 执行与解析       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ webhook.rs — Axum HTTP 服务器 (localhost:7022) │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ types.rs — 共享类型定义                               │  │
│  │ error.rs — 统一错误处理                               │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    System Layer                             │
│  ┌──────────────┐  ┌────────────────────────────────────┐  │
│  │ macOS rsync  │  │ Google Drive (本地挂载)             │  │
│  └──────────────┘  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 数据流

### 添加文件
```
用户拖放/选择 → Tauri DragDrop Event / Dialog API
    → invoke("add_entry") → validate_path() → canonicalize()
    → 去重检查 → Store 持久化 → 返回 BackupEntry
```

### 同步流程
```
用户点击 Sync / Webhook POST /sync
    → load entries from Store
    → Layer 1: generate_filelist() → 临时文件
    → Layer 2: pre_sync_check() → 路径验证 + 目标检查
    → Layer 3: build_rsync_args() → run_rsync() → 解析输出
    → 返回 SyncResult
```

## 数据模型

### BackupEntry
```rust
struct BackupEntry {
    id: Uuid,           // 唯一标识
    path: String,       // 规范化绝对路径
    item_type: ItemType, // File | Directory
    added_at: DateTime,  // 添加时间
    last_synced: Option<DateTime>, // 最近同步时间
}
```

### AppSettings
```rust
struct AppSettings {
    gdrive_path: String,       // Google Drive 挂载路径
    backup_dir_name: String,   // 备份子目录名 (默认 "ShrikeBackup")
webhook_port: u16, // Webhook 端口 (默认 7022)
    webhook_token: String,     // Bearer Token
}
```

## 安全设计

- Webhook 仅绑定 `127.0.0.1`，不对外暴露
- Bearer Token 认证
- Tauri Shell 权限仅限 rsync 和 mkdir
- rsync 不使用 `--delete`，已删除文件在备份中保留
