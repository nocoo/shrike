<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" height="128" alt="Shrike logo" />
</p>
<h1 align="center">Shrike</h1>
<p align="center">在 Mac 上选择文件和文件夹，备份到 Google Drive 的本地同步目录。</p>
<p align="center"><a href="docs/README.en.md">English</a></p>

## 这是什么

Shrike 是 macOS 桌面应用，适合只想备份部分文件、项目资料或开发工具配置的人。它通过系统 `rsync` 将选中的内容复制到 Google Drive for Desktop 的本地目录，再由 Google Drive 客户端上传到云端。

应用显示的同步完成表示本地复制完成。云端上传状态需要在 Google Drive 客户端中查看。

## 功能

- 拖入文件或文件夹，或用原生文件选择器管理备份列表。
- 用 Quick Add 查找 Claude、Cursor、OpenCode、Windsurf、Copilot、Aider 和 VS Code 的常见配置位置，再选择要加入的条目。
- 通过 `rsync` 复制新增和变更的文件，保留源文件的目录结构；不同机器可使用各自的备份子目录。
- 在窗口中手动同步，或通过带 Bearer token 的本机 HTTP 接口触发同步、查询状态。
- 支持中英文、浅色和深色主题、菜单栏入口、Dock 显示设置及登录时启动。

备份是当前文件的副本。Shrike 不维护历史快照，也没有恢复向导；同步不会删除目标目录里的旧文件，从列表移除条目也不会删除已有备份。文件按原样复制，没有额外加密，加入开发配置前应检查其中是否包含凭据。

## 使用

需要 macOS、可执行的 `rsync`，以及已安装并登录的 [Google Drive for Desktop](https://www.google.com/drive/download/)。源码构建方法见下方「开发」；发布记录见 [Releases](https://github.com/nocoo/shrike/releases)，具体安装包以各条发布记录的附件为准。

1. 打开设置，确认 Google Drive 本地目录。应用会尝试自动发现目录；多账号环境下需要核对选中的账号。
2. 设置备份文件夹名和机器名，保存设置。默认目标为 `<Google Drive 目录>/ShrikeBackup/<机器名>/`。
3. 添加文件或文件夹，点击同步。先在目标目录确认副本，再查看 Google Drive 的上传状态。

### 本机 HTTP 接口

应用运行时，接口仅监听 `127.0.0.1`。默认发布端口为 `7015`，开发端口为 `7023`；实际端口和 token 以设置页为准，修改端口后需重启应用。

```bash
curl http://127.0.0.1:7015/status \
  -H 'Authorization: Bearer <your-token>'

curl -X POST http://127.0.0.1:7015/sync \
  -H 'Authorization: Bearer <your-token>'
```

两个接口都需要鉴权。`POST /sync` 等待本次本地同步结束后返回结果；同一时间只运行一个同步任务。定时触发可由外部调度工具调用这个接口。

## 开发

安装 Bun、Node.js（建议 24 或更新版本）、支持 Rust 2024 edition 的 Rust 工具链，以及 Xcode 命令行工具。在 macOS 上执行：

```bash
git clone https://github.com/nocoo/shrike.git
cd shrike
bun install --frozen-lockfile
bun run tauri dev
```

Tauri 会启动 Next.js 开发服务并打开桌面窗口。单独运行 `bun run dev` 只提供前端页面，文件操作和同步需要 Tauri 运行环境。

```bash
bun run typecheck
bun run lint
bun run tauri build
```

前端以静态文件导出到 `out/`，由 Tauri 打包。构建产物位于 Cargo 工作区的 `target/release/` 下。

| 路径 | 内容 |
| --- | --- |
| `src/components/`、`src/hooks/` | 文件列表、设置、同步界面 |
| `src-tauri/src/commands.rs` | 桌面 IPC 命令 |
| `src-tauri/src/sync/` | 文件清单、路径检查、rsync 执行 |
| `src-tauri/src/webhook.rs` | 本机 HTTP 接口 |

设置和备份列表由 Tauri Store 保存到应用数据目录中的 `shrike_data.json`。

## 测试

先安装开发依赖；Rust 集成测试还需要系统 `rsync`。

```bash
bun run test
bun run test:rs
bun run test:e2e:rs
```

依次运行前端单元及组件测试、Rust 单元测试、Rust 集成测试。集成测试在临时目录执行真实文件复制，并使用内存中的 Axum router 验证 HTTP 请求处理；不需要登录 Google Drive，也不启动完整桌面界面。

全部运行可用 `bun run test:all`。桌面拖放、系统托盘和实际 Google Drive 上传仍需在 macOS 应用中手动检查。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| Tauri、Rust | 桌面应用、文件操作与系统集成 |
| Next.js、React、TypeScript | 静态导出的桌面界面 |
| Tailwind CSS、Radix UI | 样式与界面组件 |
| Tokio、Axum | 本机 HTTP 服务 |
| rsync | 文件复制与目录结构保留 |
| Tauri Store | 本地设置和备份列表 |
| Vitest、Testing Library、Cargo test | 前端与 Rust 测试 |

## 文档

- [架构说明](docs/02-architecture.md)
- [同步实现](src-tauri/src/sync/)
- [更新记录](CHANGELOG.md)

## 许可证

[MIT](LICENSE)
