# ClawMind

**个人 AI 学习工作站** —— 集中管理**学习资料**、**日程与任务**、**年度/季度目标进度**，配合 **AI 工作区（阅读 + 笔记 + 对话）**、**随机题库**与**艾宾浩斯复习**，把零散输入变成可追踪、可复习的成长闭环。

---

## 一句话定位（侧栏同款）

> 一个集**学习资料**、**日程**与**年度目标**管理，并配套 **AI 工作区**与**题库复习**的个人学习网站。

---

## 你能用它做什么

| 模块 | 能力 |
|------|------|
| **图书馆** | 分类管理学习资料；上传 PDF / MD / DOCX / TXT；与服务端分块入库，供检索与对话上下文 |
| **工作区** | 沉浸阅读、高亮、笔记、词汇；可选接入 OpenAI 兼容模型做文档侧对话（流式/回退 RAG） |
| **日程中心** | 学习计划与任务、日历视图；把「什么时候学」落到时间表上 |
| **目标中心** | 年度/季度目标与关键结果进度；和任务、复习节奏对齐 |
| **随机题库** | 按分类与来源抽题；笔记折叠展示，只保留学习笔记编辑与保存 |
| **设置** | 外观、数据同步、智能模型（Endpoint / Model / API Key）等 |

---

## 技术栈

- **前端**：单页 `index.html` + `app.js` + `styles.css`（响应式、浅色/深色主题）
- **后端**：Node.js + Express + **SQLite**（`sqlite3`）
- **可选 AI**：OpenAI 兼容 `chat/completions`；LangGraph Agent；服务端流式代理 `POST /api/model/chat-stream`

---

## 仓库结构（与代码一致）

```
ClawMind/
├── index.html              # 前端入口
├── app.js                  # 前端逻辑
├── styles.css              # 样式
├── clawmind.config.js      # 前端 API 基址等（可由 switch 脚本生成）
├── server/
│   ├── index.js            # HTTP API、RAG、会话、模型代理
│   └── langgraph-agent.js
├── scripts/                # 部署切换、备份等
├── data/                   # 运行时生成：db、uploads、logs、backups
├── deploy/                 # Nginx 等示例
├── .env.example
└── README.md
```

> 旧版 README 中的 `Library/`、`Notes/` 等仅为概念分区；实际资料与状态以**图书馆上传 + SQLite 同步**为准。

---

## 快速开始

1. **安装依赖**（根目录）  
   `npm install`

2. **环境变量**（可选）  
   复制 `.env.example` 为 `.env`，按需填写端口、CORS、备份、模型相关变量。

3. **启动后端**  
   `npm start`  
   默认：`http://127.0.0.1:8787`（监听 `0.0.0.0` 时可局域网访问）

4. **打开前端**  
   浏览器打开 `index.html`，或静态托管根目录；确保 `clawmind.config.js` 里 `apiBaseUrl` 指向你的后端，例如 `http://127.0.0.1:8787/api`。

### 一键切换部署模式

- **局域网可访问**：`npm run switch:local-lan`（自动写 `clawmind.config.js` 与 `.env`）
- **反代/HTTPS 模式**：`npm run switch:server`

---

## 环境变量摘要

| 变量 | 说明 |
|------|------|
| `PORT` / `HOST` | 后端端口与监听地址 |
| `CORS_ALLOWLIST` | 逗号分隔的来源白名单 |
| `ENABLE_ACCESS_LOG` | 访问日志开关 |
| `BACKUP_INTERVAL_MINUTES` / `BACKUP_RETENTION_DAYS` | 自动备份与保留 |
| `MANUAL_BACKUP_TOKEN` | 手动备份接口令牌 |
| `RAG_*` | 分块大小、上传上限等 |
| `CHAT_CONTEXT_MESSAGE_LIMIT` | 流式/会话对话带入的历史消息条数上限（默认 16） |

---

## 主要 HTTP API

- **健康**：`GET /api/health`
- **鉴权**：`POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`
- **状态同步**：`GET/PUT /api/state`（分类、题库、学习记录）
- **RAG**：`POST /api/rag/upload`、`POST /api/rag/ingest`、`POST /api/rag/chat`
- **会话**：`POST/GET /api/rag/sessions`、`GET /api/rag/sessions/:id/messages`、`DELETE ...`
- **模型**：`POST /api/agent/chat`（LangGraph）、`POST /api/model/chat`（JSON 非流式）、`POST /api/model/chat-stream`（SSE 流式，会话落库）

默认开发账号（若未改库）：用户名 `local-user`，密码 `123456`。

---

## 打包 Windows EXE

```bash
npm install
npm run build:exe
```

产物：`dist/ClawMind.exe`。同目录可放 `.exe`；运行后会在同目录生成 `data/`（数据库、上传、日志、备份）。

---

## 数据位置

| 路径 | 用途 |
|------|------|
| `data/clawmind.db` | SQLite |
| `data/uploads/` | 用户上传文件 |
| `data/logs/` | 访问日志等 |
| `data/backups/` | 数据库备份 |

手动备份：`npm run backup:db` 或配置 `POST /api/admin/backup`。

---

## 公网部署建议

1. 后端监听 `0.0.0.0:8787`，防火墙放行端口。  
2. 生产环境务必使用 **HTTPS + 反向代理**（参考 `deploy/nginx.clawmind.conf.example`）。  
3. 配置 `CORS_ALLOWLIST` 与实际访问域名一致。

---

## Skills（可选增强）

部分环境会挂载 Skills（如 PDF 解析、定时任务等）；与核心 ClawMind 功能独立，可按需安装。

---

## 许可证

以仓库内声明为准；商用前请自行审查依赖与模型服务条款。
