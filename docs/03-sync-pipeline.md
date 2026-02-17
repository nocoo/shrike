# Shrike 同步管线设计

## 三层管线架构

Shrike 的同步引擎采用三层管线设计，以 filelist 文件为切分点，每一层职责单一、可独立测试。

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Layer 1   │───▶│   Layer 2    │───▶│   Layer 3   │
│  Filelist   │    │  Validation  │    │  Executor   │
│  Generation │    │              │    │             │
└─────────────┘    └──────────────┘    └─────────────┘
```

## Layer 1: Filelist 生成 (`filelist.rs`)

### 职责
将 `BackupEntry` 列表转换为 rsync `--files-from` 所需的临时文件。

### 核心函数

| 函数 | 功能 | 输入 | 输出 |
| --- | --- | --- | --- |
| `generate_filelist()` | 生成 filelist 文件 | `&[BackupEntry]` | `NamedTempFile` |
| `read_filelist()` | 读取 filelist 内容 | `&Path` | `Vec<String>` |
| `filelist_path_str()` | 获取文件路径字符串 | `&NamedTempFile` | `String` |

### 设计要点
- 每个路径占一行，以换行符分隔
- 保持条目顺序不变
- 支持 Unicode 路径和空格路径
- 临时文件由调用者持有 handle，释放时自动删除
- 空条目列表产生空文件（合法但会被 Layer 2 拦截）

### 测试覆盖 (13 个测试)
- 多路径写入、空列表、单条目
- Unicode 路径、含空格路径
- 顺序保持、行格式验证
- 读取 roundtrip、空白行过滤
- 不存在文件错误、UTF-8 路径验证
- 大批量 (1000 条目) 性能验证

## Layer 2: 验证 (`validation.rs`)

### 职责
验证 filelist 中每条路径的合法性，确保 rsync 执行前所有前置条件满足。

### 核心函数

| 函数 | 功能 | 返回 |
| --- | --- | --- |
| `validate_path()` | 验证单条路径 | `PathValidation` |
| `validate_filelist()` | 批量验证路径列表 | `ValidationReport` |
| `validate_destination()` | 验证目标目录 | `Result<()>` |
| `pre_sync_check()` | 完整前置检查 | `Result<ValidationReport>` |

### 验证规则

1. **绝对路径检查**: 路径必须以 `/` 开头
2. **存在性检查**: 路径对应的文件/目录必须存在
3. **可读性检查**: 必须能读取文件元数据
4. **去重检查**: 检测并报告重复路径
5. **目标目录检查**: 目标必须是目录（不存在则自动创建）

### 验证结果类型

```rust
enum PathValidation {
    Valid,
    NotFound(String),
    NotReadable(String),
    NotAbsolute(String),
}

struct ValidationReport {
    total: usize,
    valid_count: usize,
    errors: Vec<PathValidation>,
    duplicates: Vec<String>,
}
```

### 容错策略
- 部分路径无效时：继续执行，仅报告问题
- 全部路径无效时：终止执行，返回错误
- 空列表时：终止执行，返回 "no entries to sync"

### 测试覆盖 (23 个测试)
- 单路径验证：存在文件/目录、不存在路径、相对路径、空字符串
- 批量验证：全部合法、含缺失路径、重复检测、多重复、全无效、空列表、混合问题
- Report 功能：摘要格式、is_ok/has_issues 判断
- 目标目录：存在目录、创建缺失目录、文件非目录错误
- 前置检查：空条目、全合法、全无效、部分合法、坏目标

## Layer 3: 执行 (`executor.rs`)

### 职责
构建 rsync 命令参数、执行 rsync 进程、解析输出。

### 核心函数

| 函数 | 功能 |
| --- | --- |
| `build_rsync_args()` | 构建 rsync CLI 参数 |
| `count_transferred_files()` | 解析 rsync 输出中的文件传输数 |
| `run_rsync()` | 执行 rsync 并返回 `SyncResult` |

### Rsync 命令格式
```bash
rsync -avR --files-from=<tmpfile> / <destination>/
```

- `-a`: 归档模式（保留属性）
- `-v`: 详细输出
- `-R`: 相对路径（保留完整目录结构）
- `--files-from`: 从 filelist 文件读取路径
- 源为 `/`，配合绝对路径在 files-from 中的使用

### 输出解析规则
跳过以下行：
- 空行或纯空白行
- `sending` 开头（增量列表提示）
- `sent ` 开头（传输统计）
- `total ` 开头（总计统计）
- `building ` 开头（构建文件列表）
- `.` 和 `./`（目录标记）

### 测试覆盖 (16 个测试)
- 参数构建：正确格式、Unicode 目标、尾部斜杠、根源、含空格路径
- 输出解析：典型输出、空输出、无传输、dot/dotslash 跳过、building 行、多目录、Unicode 文件名、空白行
- 实际执行：不存在 filelist 失败、空 filelist 成功、真实文件传输

## 管线集成 (`mod.rs`)

### `execute_sync()` 主入口

```rust
pub fn execute_sync(entries: &[BackupEntry], settings: &AppSettings) -> Result<SyncResult> {
    // Layer 1: 生成 filelist
    let filelist_file = filelist::generate_filelist(entries)?;
    let filelist_path = filelist::filelist_path_str(&filelist_file)?;

    // Layer 2: 验证
    let paths = filelist::read_filelist(filelist_file.path())?;
    let _report = validation::pre_sync_check(&paths, &destination)?;

    // Layer 3: 执行 rsync
    let args = executor::build_rsync_args(&filelist_path, &destination);
    let result = executor::run_rsync(&args)?;

    Ok(result)
}
```

### 集成测试 (4 个测试)
- 空条目失败
- 真实文件同步
- 不存在文件失败
- 完整管线集成（多文件）

## 测试统计

| 模块 | 单元测试 | 覆盖点 |
| --- | --- | --- |
| filelist.rs | 13 | 生成、读取、格式、边界 |
| validation.rs | 23 | 路径验证、批量、报告、目标 |
| executor.rs | 16 | 参数、解析、执行 |
| mod.rs (集成) | 4 | 管线端到端 |
| **合计** | **56** | |
