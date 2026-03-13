const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mammoth = require("mammoth");
let sqlite3;
try {
  sqlite3 = require("sqlite3").verbose();
} catch (error) {
  console.error("[ClawMind] sqlite3 load failed:", error?.message || error);
  console.error("[ClawMind] 请确认 EXE 已打包 sqlite3 native 文件，或安装 VC++ 2015-2022 x64 运行库。");
  process.exit(1);
}
const { invokeLangGraphAgent } = require("./langgraph-agent");

const RUNTIME_ROOT = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, "..");
const ENV_FILE_PATH = path.join(RUNTIME_ROOT, ".env");
const ENV_TEMPLATE_PATH = path.join(__dirname, "..", ".env.example");

function ensureRuntimeEnvFile() {
  if (!process.pkg) return;
  if (fs.existsSync(ENV_FILE_PATH)) return;
  let content = "HOST=0.0.0.0\nPORT=8787\nCORS_ALLOWLIST=\nENABLE_ACCESS_LOG=true\nBACKUP_INTERVAL_MINUTES=360\nBACKUP_RETENTION_DAYS=7\nMANUAL_BACKUP_TOKEN=\nRAG_INGEST_MAX_CHUNKS=300\nRAG_INGEST_CHUNK_SIZE=1000\nRAG_INGEST_CHUNK_OVERLAP=120\nRAG_UPLOAD_MAX_FILE_MB=20\n";
  if (fs.existsSync(ENV_TEMPLATE_PATH)) {
    try {
      content = fs.readFileSync(ENV_TEMPLATE_PATH, "utf8");
    } catch {
    }
  }
  try {
    fs.writeFileSync(ENV_FILE_PATH, content, "utf8");
  } catch {
  }
}

try {
  ensureRuntimeEnvFile();
  const envPath = fs.existsSync(ENV_FILE_PATH) ? ENV_FILE_PATH : path.join(__dirname, "..", ".env");
  require("dotenv").config({ path: envPath });
} catch {
}

const app = express();
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, "..");
const DATA_DIR = path.join(RUNTIME_DIR, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const LOG_DIR = path.join(DATA_DIR, "logs");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const DB_PATH = path.join(DATA_DIR, "clawmind.db");
const DEFAULT_USER_ID = "local-user";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WEB_ROOT = path.join(__dirname, "..");
const RAG_INGEST_MAX_CHUNKS = Number(process.env.RAG_INGEST_MAX_CHUNKS || 300);
const RAG_INGEST_CHUNK_SIZE = Number(process.env.RAG_INGEST_CHUNK_SIZE || 1000);
const RAG_INGEST_CHUNK_OVERLAP = Number(process.env.RAG_INGEST_CHUNK_OVERLAP || 120);
const RAG_UPLOAD_MAX_FILE_MB = Number(process.env.RAG_UPLOAD_MAX_FILE_MB || 20);
const CORS_ALLOWLIST = String(process.env.CORS_ALLOWLIST || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const ENABLE_ACCESS_LOG = String(process.env.ENABLE_ACCESS_LOG || "true").toLowerCase() !== "false";
const BACKUP_INTERVAL_MINUTES = Number(process.env.BACKUP_INTERVAL_MINUTES || 360);
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 7);
const MANUAL_BACKUP_TOKEN = String(process.env.MANUAL_BACKUP_TOKEN || "").trim();
// Chat configuration
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "");
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-3.5-turbo");
const CHAT_CONTEXT_LIMIT = Number(process.env.CHAT_CONTEXT_LIMIT || 10);
let backupTimer = null;

/**
 * 确保服务所需目录存在。
 */
function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * 创建并返回 SQLite 数据库连接。
 * @returns {import("sqlite3").Database} 数据库实例。
 */
function createDb() {
  ensureDirs();
  return new sqlite3.Database(DB_PATH);
}

const db = createDb();

/**
 * 执行 SQL（无返回行）。
 * @param {string} sql SQL 语句。
 * @param {any[]} params 参数数组。
 * @returns {Promise<void>} 执行结果。
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * 查询 SQL（返回多行）。
 * @param {string} sql SQL 语句。
 * @param {any[]} params 参数数组。
 * @returns {Promise<any[]>} 结果行。
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows || []);
    });
  });
}

/**
 * 查询 SQL（返回单行）。
 * @param {string} sql SQL 语句。
 * @param {any[]} params 参数数组。
 * @returns {Promise<any|null>} 单行结果。
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row || null);
    });
  });
}

/**
 * 判断指定表是否存在。
 * @param {string} tableName 表名。
 * @returns {Promise<boolean>} 是否存在。
 */
async function tableExists(tableName) {
  const row = await get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName],
  );
  return Boolean(row);
}

/**
 * 标准化文本，便于后端去重。
 * @param {string} text 原始文本。
 * @returns {string} 标准化文本。
 */
function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 将原始文本按固定窗口切分为可检索片段。
 * @param {string} rawText 原始文本。
 * @param {{chunkSize:number,overlap:number,maxChunks:number}} options 切分配置。
 * @returns {Array<{text:string,meta:{range:[number,number],kind:string}}>} 片段列表。
 */
function splitTextToChunks(rawText, options) {
  const normalized = String(rawText || "").replace(/\r\n/g, "\n");
  const chunkSize = Math.max(200, Number(options?.chunkSize || RAG_INGEST_CHUNK_SIZE));
  const overlap = Math.max(0, Math.min(chunkSize - 1, Number(options?.overlap || RAG_INGEST_CHUNK_OVERLAP)));
  const maxChunks = Math.max(1, Number(options?.maxChunks || RAG_INGEST_MAX_CHUNKS));
  const chunks = [];
  let start = 0;
  while (start < normalized.length && chunks.length < maxChunks) {
    const end = Math.min(normalized.length, start + chunkSize);
    const text = normalized.slice(start, end).trim();
    if (text) {
      chunks.push({
        text,
        meta: { range: [start, end], kind: "auto-split" },
      });
    }
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

/**
 * 过滤文件名中的非法字符，避免目录穿越与路径污染。
 * @param {string} name 原始文件名。
 * @returns {string} 安全文件名。
 */
function sanitizeFileName(name) {
  return String(name || "upload.bin")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "upload.bin";
}

/**
 * 返回用户上传目录并确保目录存在。
 * @param {string} userId 用户 id。
 * @returns {string} 目录绝对路径。
 */
function ensureUserUploadDir(userId) {
  const safeUser = sanitizeFileName(userId || "anonymous");
  const userDir = path.join(UPLOAD_DIR, safeUser);
  fs.mkdirSync(userDir, { recursive: true });
  return userDir;
}

/**
 * 从上传文件中提取纯文本，用于服务端分块入库。
 * @param {{path:string,mimetype:string,originalname:string}} file 上传文件信息。
 * @returns {Promise<string>} 提取出的文本。
 */
async function extractTextFromUploadedFile(file) {
  const filePath = String(file?.path || "");
  const mime = String(file?.mimetype || "").toLowerCase();
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  if (!filePath) return "";
  if (ext === ".txt" || ext === ".md" || mime.includes("text/")) {
    return fs.promises.readFile(filePath, "utf8").catch(() => "");
  }
  if (ext === ".pdf" || mime.includes("pdf")) {
    try {
      // 延迟加载，避免某些环境下 pdf 依赖在服务启动期报错。
      // eslint-disable-next-line global-require
      const pdfParse = require("pdf-parse");
      const buffer = await fs.promises.readFile(filePath).catch(() => null);
      if (!buffer) return "";
      const data = await pdfParse(buffer).catch(() => null);
      return String(data?.text || "");
    } catch {
      return "";
    }
  }
  if (ext === ".docx" || mime.includes("officedocument.wordprocessingml.document")) {
    const data = await mammoth.extractRawText({ path: filePath }).catch(() => null);
    return String(data?.value || "");
  }
  return "";
}

/**
 * 将分块写入 document_chunks 表（同文件先删后插）。
 * @param {string} userId 用户 id。
 * @param {string} fileName 文件标识名。
 * @param {Array<{text:string,meta?:any}>} chunks 片段数组。
 * @returns {Promise<number>} 实际写入数量。
 */
async function ingestChunksForFile(userId, fileName, chunks) {
  await run("DELETE FROM document_chunks WHERE user_id = ? AND file_name = ?", [userId, fileName]);
  let inserted = 0;
  for (const item of chunks) {
    const text = String(item?.text || "").trim();
    if (!text) continue;
    await run(
      `INSERT INTO document_chunks(id, user_id, file_name, chunk_text, chunk_norm, meta_json, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("chunk"),
        userId,
        fileName,
        text,
        normalizeText(text),
        JSON.stringify(item?.meta || {}),
        new Date().toISOString(),
      ],
    );
    inserted += 1;
    if (inserted >= RAG_INGEST_MAX_CHUNKS) break;
  }
  return inserted;
}

/**
 * 生成 CORS 配置，支持生产白名单。
 * @returns {import("cors").CorsOptions} CORS 配置。
 */
function createCorsOptions() {
  if (CORS_ALLOWLIST.length === 0) {
    return { origin: true, credentials: true };
  }
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || CORS_ALLOWLIST.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
  };
}

/**
 * 记录单次请求访问日志，便于部署排障。
 * @param {import("express").Request} req 请求对象。
 * @param {import("express").Response} res 响应对象。
 * @param {import("express").NextFunction} next 下一步回调。
 */
function accessLogMiddleware(req, res, next) {
  if (!ENABLE_ACCESS_LOG) {
    next();
    return;
  }
  const startedAt = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - startedAt;
    const line = [
      new Date().toISOString(),
      req.method,
      req.originalUrl,
      String(res.statusCode),
      `${elapsed}ms`,
      `ip=${req.ip || "-"}`,
      `uid=${req.authUser?.id || "-"}`,
    ].join(" | ");
    fs.appendFile(path.join(LOG_DIR, "access.log"), `${line}\n`, { encoding: "utf8" }, () => {});
  });
  next();
}

/**
 * 生成数据库备份文件名时间戳。
 * @returns {string} 文件名安全时间戳。
 */
function buildBackupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * 创建 SQLite 数据库备份副本。
 * @param {string} reason 触发备份原因。
 * @returns {Promise<{ok:boolean,file:string}>} 备份结果。
 */
async function createDbBackup(reason) {
  ensureDirs();
  const fileName = `clawmind-${buildBackupTimestamp()}-${reason}.db`;
  const backupPath = path.join(BACKUP_DIR, fileName);
  await fs.promises.copyFile(DB_PATH, backupPath);
  return { ok: true, file: backupPath };
}

/**
 * 清理过期备份文件，避免磁盘无限增长。
 * @returns {Promise<void>} 清理流程。
 */
async function cleanupOldBackups() {
  const ttlMs = Math.max(1, BACKUP_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const files = await fs.promises.readdir(BACKUP_DIR).catch(() => []);
  for (const name of files) {
    if (!name.endsWith(".db")) continue;
    const filePath = path.join(BACKUP_DIR, name);
    try {
      const stat = await fs.promises.stat(filePath);
      if (now - stat.mtimeMs > ttlMs) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // 忽略清理异常，避免影响主流程。
    }
  }
}

/**
 * 启动定时备份任务。
 */
function startBackupScheduler() {
  const intervalMs = Math.max(10, BACKUP_INTERVAL_MINUTES) * 60 * 1000;
  if (backupTimer) clearInterval(backupTimer);
  backupTimer = setInterval(() => {
    void createDbBackup("cron").then(() => cleanupOldBackups()).catch(() => {});
  }, intervalMs);
}

/**
 * 生成随机 id。
 * @param {string} prefix 前缀。
 * @returns {string} 随机 id。
 */
function createId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * 使用 SHA-256 计算密码摘要。
 * @param {string} password 原始密码。
 * @param {string} salt 随机盐。
 * @returns {string} 哈希摘要。
 */
function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

/**
 * 生成访问令牌。
 * @returns {string} 令牌字符串。
 */
function createAccessToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * 为用户签发访问令牌并入库。
 * @param {string} userId 用户 id。
 * @returns {Promise<{token:string,expiresAt:string}>} 令牌信息。
 */
async function issueAccessToken(userId) {
  const token = createAccessToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await run(
    "INSERT INTO auth_tokens(token, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)",
    [token, userId, expiresAt, new Date().toISOString()],
  );
  return { token, expiresAt };
}

/**
 * 解析并返回 Bearer Token。
 * @param {import("express").Request} req 请求对象。
 * @returns {string} token 字符串。
 */
function readBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

/**
 * 鉴权中间件：校验 token 并挂载 req.authUser。
 * @param {import("express").Request} req 请求对象。
 * @param {import("express").Response} res 响应对象。
 * @param {import("express").NextFunction} next 下一步回调。
 */
async function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, message: "未登录或登录已失效" });
    return;
  }
  try {
    const row = await get(
      `SELECT t.token, t.user_id AS userId, t.expires_at AS expiresAt, u.username
       FROM auth_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = ?`,
      [token],
    );
    if (!row) {
      res.status(401).json({ ok: false, message: "登录令牌无效" });
      return;
    }
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      await run("DELETE FROM auth_tokens WHERE token = ?", [token]).catch(() => {});
      res.status(401).json({ ok: false, message: "登录令牌已过期，请重新登录" });
      return;
    }
    req.authUser = { id: String(row.userId), username: String(row.username), token };
    next();
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
}

/**
 * 计算片段与问题 token 的匹配分值。
 * @param {string[]} tokens 分词结果。
 * @param {string} text 片段文本。
 * @returns {number} 匹配分值。
 */
function scoreChunk(tokens, text) {
  if (!Array.isArray(tokens) || tokens.length === 0) return 0;
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  tokens.forEach((token) => {
    if (!token) return;
    if (normalized.includes(token)) {
      score += token.length >= 4 ? 3 : 2;
    }
  });
  return score;
}

/**
 * 将用户问题切分为 token。
 * @param {string} query 用户问题。
 * @returns {string[]} token 数组。
 */
function tokenizeQuery(query) {
  const text = normalizeText(query);
  if (!text) return [];
  const raw = text.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{2,}/gi) || [];
  return [...new Set(raw)];
}

/**
 * 基于会话历史与检索片段生成回答。
 * @param {string} query 用户提问。
 * @param {Array<{role:string,content:string}>} recentMessages 最近消息。
 * @param {Array<{text:string,meta:string,score:number}>} chunks 检索片段。
 * @returns {{answer:string,references:string[]}} 回答结果。
 */
function buildServerAnswer(query, recentMessages, chunks) {
  const refs = chunks.slice(0, 3).map((item) => `${item.meta}：${String(item.text || "").slice(0, 100)}`);
  const recentUser = [...recentMessages].reverse().find((item) => item.role === "user" && item.content !== query);
  const historyHint = recentUser ? `\n你上一轮提到：${recentUser.content.slice(0, 60)}` : "";
  if (chunks.length === 0) {
    return {
      answer: `我已记录你的问题：“${query}”。当前会话中暂无可检索片段，建议先上传文档并提取内容后再问。${historyHint}`,
      references: [],
    };
  }
  const lines = chunks.slice(0, 3).map((item, index) => `${index + 1}. ${String(item.text || "").slice(0, 120)}`);
  return {
    answer: `基于当前会话上下文，我的回答如下：\n${lines.join("\n")}\n你可以继续追问细节，我会保留会话历史。${historyHint}`,
    references: refs,
  };
}

/**
 * 初始化数据库表结构。
 * @returns {Promise<void>} 初始化流程。
 */
async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id
    ON auth_tokens(user_id)
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS library_categories_v2 (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      parent_id TEXT,
      PRIMARY KEY (user_id, id)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS question_bank_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      content_norm TEXT NOT NULL,
      category_norm TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_question_dedupe
    ON question_bank_v2(user_id, category_norm, content_norm)
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS learning_records_v2 (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      doc_name TEXT NOT NULL,
      category TEXT,
      last_study_at TEXT,
      note_hint TEXT
    )
  `);
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_records_user_doc
    ON learning_records_v2(user_id, doc_name)
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS rag_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS rag_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      references_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      chunk_text TEXT NOT NULL,
      chunk_norm TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  const defaultRow = await get("SELECT id FROM users WHERE id = ?", [DEFAULT_USER_ID]);
  if (!defaultRow) {
    const salt = crypto.randomBytes(8).toString("hex");
    const hash = hashPassword("123456", salt);
    await run(
      "INSERT INTO users(id, username, password_hash, password_salt, created_at) VALUES(?, ?, ?, ?, ?)",
      [DEFAULT_USER_ID, "local-user", hash, salt, new Date().toISOString()],
    );
  }

  await migrateLegacyDataToUserScopedTables();
}

/**
 * 将旧表数据迁移到带 user_id 的新表，保证历史数据可读。
 * @returns {Promise<void>} 迁移流程。
 */
async function migrateLegacyDataToUserScopedTables() {
  if (await tableExists("library_categories")) {
    const oldCategories = await all("SELECT id, name, icon, parent_id AS parentId FROM library_categories");
    for (const item of oldCategories) {
      await run(
        `INSERT OR IGNORE INTO library_categories_v2(user_id, id, name, icon, parent_id)
         VALUES(?, ?, ?, ?, ?)`,
        [
          DEFAULT_USER_ID,
          String(item.id || ""),
          String(item.name || ""),
          String(item.icon || "📁"),
          item.parentId || null,
        ],
      );
    }
  }

  if (await tableExists("question_bank")) {
    const oldQuestions = await all(`
      SELECT category, content, answer, source, content_norm AS contentNorm, category_norm AS categoryNorm, created_at AS createdAt
      FROM question_bank
    `);
    for (const item of oldQuestions) {
      const category = String(item.category || "").trim();
      const content = String(item.content || "").trim();
      const answer = String(item.answer || "").trim();
      if (!category || !content || !answer) continue;
      await run(
        `INSERT OR IGNORE INTO question_bank_v2
         (user_id, category, content, answer, source, content_norm, category_norm, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          DEFAULT_USER_ID,
          category,
          content,
          answer,
          String(item.source || "manual"),
          String(item.contentNorm || normalizeText(content)),
          String(item.categoryNorm || normalizeText(category)),
          String(item.createdAt || new Date().toISOString()),
        ],
      );
    }
  }

  if (await tableExists("learning_records")) {
    const oldRecords = await all(`
      SELECT id, doc_name AS docName, category, last_study_at AS lastStudyAt, note_hint AS noteHint
      FROM learning_records
    `);
    for (const item of oldRecords) {
      const docName = String(item.docName || "").trim();
      if (!docName) continue;
      const id = String(item.id || createId("lr"));
      await run(
        `INSERT OR IGNORE INTO learning_records_v2
         (id, user_id, doc_name, category, last_study_at, note_hint)
         VALUES(?, ?, ?, ?, ?, ?)`,
        [
          id,
          DEFAULT_USER_ID,
          docName,
          String(item.category || ""),
          String(item.lastStudyAt || ""),
          String(item.noteHint || ""),
        ],
      );
    }
  }
}

app.set("trust proxy", 1);
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: "4mb" }));
app.use(accessLogMiddleware);

function resolveWebAsset(requestPath) {
  const normalized = path.posix.normalize(String(requestPath || ""));
  const rel = normalized.replace(/^\/+/, "");
  const abs = path.resolve(WEB_ROOT, rel);
  const root = path.resolve(WEB_ROOT);
  if (!abs.toLowerCase().startsWith(root.toLowerCase())) return "";
  return abs;
}

function sendWebFile(res, relativePath) {
  const target = path.join(WEB_ROOT, relativePath);
  res.sendFile(target);
}

app.get("/", (_req, res) => sendWebFile(res, "index.html"));
app.get("/index.html", (_req, res) => sendWebFile(res, "index.html"));
app.get("/styles.css", (_req, res) => sendWebFile(res, "styles.css"));
app.get("/app.js", (_req, res) => sendWebFile(res, "app.js"));
app.get("/clawmind.config.js", (_req, res) => sendWebFile(res, "clawmind.config.js"));
app.get(["/src/*", "/assets/*"], (req, res) => {
  const abs = resolveWebAsset(req.path);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).end();
    return;
  }
  res.sendFile(abs);
});

/**
 * 配置上传中间件：按用户隔离目录并限制单文件大小。
 */
const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination(req, _file, callback) {
      const userId = String(req.authUser?.id || DEFAULT_USER_ID);
      callback(null, ensureUserUploadDir(userId));
    },
    filename(_req, file, callback) {
      const safeName = sanitizeFileName(file.originalname);
      callback(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`);
    },
  }),
  limits: {
    fileSize: Math.max(1, RAG_UPLOAD_MAX_FILE_MB) * 1024 * 1024,
  },
});

/**
 * 健康检查接口。
 */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    dbPath: DB_PATH,
    uploadDir: UPLOAD_DIR,
    corsAllowlist: CORS_ALLOWLIST,
    accessLogEnabled: ENABLE_ACCESS_LOG,
    backup: {
      intervalMinutes: BACKUP_INTERVAL_MINUTES,
      retentionDays: BACKUP_RETENTION_DAYS,
    },
  });
});

/**
 * 手动触发数据库备份（部署运维接口）。
 */
app.post("/api/admin/backup", async (req, res) => {
  if (!MANUAL_BACKUP_TOKEN) {
    res.status(403).json({ ok: false, message: "未配置 MANUAL_BACKUP_TOKEN，禁止手动备份" });
    return;
  }
  const token = String(req.headers["x-backup-token"] || "").trim();
  if (!token || token !== MANUAL_BACKUP_TOKEN) {
    res.status(401).json({ ok: false, message: "备份令牌无效" });
    return;
  }
  try {
    const result = await createDbBackup("manual");
    await cleanupOldBackups();
    res.json({ ok: true, file: result.file });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 最小注册接口（开发阶段）。
 */
app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  if (!username || password.length < 6) {
    res.status(400).json({ ok: false, message: "用户名不能为空，且密码至少 6 位" });
    return;
  }
  try {
    const id = createId("user");
    const salt = crypto.randomBytes(8).toString("hex");
    const hash = hashPassword(password, salt);
    await run(
      "INSERT INTO users(id, username, password_hash, password_salt, created_at) VALUES(?, ?, ?, ?, ?)",
      [id, username, hash, salt, new Date().toISOString()],
    );
    const tokenInfo = await issueAccessToken(id);
    res.json({
      ok: true,
      user: { id, username },
      auth: tokenInfo,
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("UNIQUE") || message.includes("users.username")) {
      res.status(409).json({ ok: false, message: "该用户名已存在，请更换后重试" });
      return;
    }
    res.status(500).json({ ok: false, message });
  }
});

/**
 * 最小登录接口（开发阶段）。
 */
app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  if (!username || !password) {
    res.status(400).json({ ok: false, message: "用户名和密码不能为空" });
    return;
  }
  try {
    const user = await get("SELECT id, username, password_hash, password_salt FROM users WHERE username = ?", [username]);
    if (!user) {
      res.status(401).json({ ok: false, message: "用户不存在或密码错误" });
      return;
    }
    const digest = hashPassword(password, user.password_salt);
    if (digest !== user.password_hash) {
      res.status(401).json({ ok: false, message: "用户不存在或密码错误" });
      return;
    }
    const tokenInfo = await issueAccessToken(String(user.id));
    res.json({
      ok: true,
      user: { id: user.id, username: user.username },
      auth: tokenInfo,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 返回当前登录用户信息。
 */
app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ ok: true, user: req.authUser ? { id: req.authUser.id, username: req.authUser.username } : null });
});

/**
 * 注销当前登录令牌。
 */
app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    const token = req.authUser?.token || "";
    if (token) {
      await run("DELETE FROM auth_tokens WHERE token = ?", [token]);
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 读取核心状态快照。
 */
app.get("/api/state", requireAuth, async (_req, res) => {
  try {
    const userId = String(_req.authUser?.id || DEFAULT_USER_ID);
    const categories = await all(`
      SELECT id, name, icon, parent_id AS parentId
      FROM library_categories_v2
      WHERE user_id = ?
      ORDER BY id ASC
    `, [userId]);
    const questionBank = await all(`
      SELECT id, category, content, answer, source, created_at AS createdAt
      FROM question_bank_v2
      WHERE user_id = ?
      ORDER BY id ASC
    `, [userId]);
    const learningRecords = await all(`
      SELECT id, doc_name AS docName, category, last_study_at AS lastStudyAt, note_hint AS noteHint
      FROM learning_records_v2
      WHERE user_id = ?
      ORDER BY doc_name ASC
    `, [userId]);
    res.json({
      ok: true,
      state: {
        libraryCategories: categories,
        questionBank,
        learningRecords,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 覆盖写入核心状态（用于前端周期同步）。
 */
app.put("/api/state", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const payload = req.body || {};
  const categories = Array.isArray(payload.libraryCategories) ? payload.libraryCategories : [];
  const questionBank = Array.isArray(payload.questionBank) ? payload.questionBank : [];
  const learningRecords = Array.isArray(payload.learningRecords) ? payload.learningRecords : [];

  try {
    await run("BEGIN TRANSACTION");
    await run("DELETE FROM library_categories_v2 WHERE user_id = ?", [userId]);
    await run("DELETE FROM question_bank_v2 WHERE user_id = ?", [userId]);
    await run("DELETE FROM learning_records_v2 WHERE user_id = ?", [userId]);

    for (const item of categories) {
      await run(
        "INSERT INTO library_categories_v2(user_id, id, name, icon, parent_id) VALUES(?, ?, ?, ?, ?)",
        [userId, String(item.id || ""), String(item.name || ""), String(item.icon || "📁"), item.parentId || null],
      );
    }

    for (const item of questionBank) {
      const category = String(item.category || "").trim();
      const content = String(item.content || "").trim();
      const answer = String(item.answer || "").trim();
      if (!category || !content || !answer) continue;
      await run(
        `INSERT OR IGNORE INTO question_bank_v2
        (user_id, category, content, answer, source, content_norm, category_norm, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          category,
          content,
          answer,
          String(item.source || "manual"),
          normalizeText(content),
          normalizeText(category),
          String(item.createdAt || new Date().toISOString()),
        ],
      );
    }

    for (const item of learningRecords) {
      const id = String(item.id || `lr-${Date.now()}-${Math.random()}`);
      const docName = String(item.docName || "").trim();
      if (!docName) continue;
      await run(
        `INSERT INTO learning_records_v2(id, user_id, doc_name, category, last_study_at, note_hint)
         VALUES(?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, doc_name) DO UPDATE SET
           category=excluded.category,
           last_study_at=excluded.last_study_at,
           note_hint=excluded.note_hint`,
        [
          id,
          userId,
          docName,
          String(item.category || ""),
          String(item.lastStudyAt || ""),
          String(item.noteHint || ""),
        ],
      );
    }

    await run("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 单条新增题库接口（服务端去重）。
 */
app.post("/api/question-bank", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const category = String(req.body?.category || "").trim();
  const content = String(req.body?.content || "").trim();
  const answer = String(req.body?.answer || "").trim();
  const source = String(req.body?.source || "manual");
  if (!category || !content || !answer) {
    res.status(400).json({ ok: false, message: "分类、题目、答案不能为空" });
    return;
  }
  try {
    await run(
      `INSERT OR IGNORE INTO question_bank_v2
      (user_id, category, content, answer, source, content_norm, category_norm, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, category, content, answer, source, normalizeText(content), normalizeText(category), new Date().toISOString()],
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 文档片段入库接口（用于后续向量化前的检索基础）。
 */
app.post("/api/rag/upload", requireAuth, uploadMiddleware.single("file"), async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const file = req.file;
  if (!file) {
    res.status(400).json({ ok: false, message: "请上传文件（字段名 file）" });
    return;
  }
  try {
    const logicalName = sanitizeFileName(String(file.originalname || file.filename || ""));
    const rawText = await extractTextFromUploadedFile(file);
    const chunks = splitTextToChunks(rawText, {
      chunkSize: RAG_INGEST_CHUNK_SIZE,
      overlap: RAG_INGEST_CHUNK_OVERLAP,
      maxChunks: RAG_INGEST_MAX_CHUNKS,
    });
    const inserted = await ingestChunksForFile(userId, logicalName, chunks);
    res.json({
      ok: true,
      file: {
        name: logicalName,
        mime: file.mimetype,
        size: file.size,
        savedPath: file.path,
      },
      ingest: {
        inserted,
        maxChunks: RAG_INGEST_MAX_CHUNKS,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 文档片段入库接口（用于后续向量化前的检索基础）。
 */
app.post("/api/rag/ingest", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const fileName = String(req.body?.fileName || "").trim();
  const rawText = String(req.body?.rawText || "").trim();
  const incomingChunks = Array.isArray(req.body?.chunks) ? req.body.chunks : [];
  const chunks = incomingChunks.length > 0
    ? incomingChunks
    : splitTextToChunks(rawText, {
      chunkSize: RAG_INGEST_CHUNK_SIZE,
      overlap: RAG_INGEST_CHUNK_OVERLAP,
      maxChunks: RAG_INGEST_MAX_CHUNKS,
    });
  if (!fileName || chunks.length === 0) {
    res.status(400).json({ ok: false, message: "fileName 与可入库内容不能为空" });
    return;
  }
  try {
    const inserted = await ingestChunksForFile(userId, fileName, chunks);
    res.json({ ok: true, inserted, maxChunks: RAG_INGEST_MAX_CHUNKS });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 创建会话接口。
 */
app.post("/api/rag/sessions", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const title = String(req.body?.title || "新会话").trim();
  try {
    const id = createId("session");
    const now = new Date().toISOString();
    await run(
      "INSERT INTO rag_sessions(id, user_id, title, created_at, updated_at) VALUES(?, ?, ?, ?, ?)",
      [id, userId, title, now, now],
    );
    res.json({ ok: true, session: { id, userId, title, createdAt: now, updatedAt: now } });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 查询用户会话列表。
 */
app.get("/api/rag/sessions", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  try {
    const sessions = await all(
      `SELECT id, user_id AS userId, title, created_at AS createdAt, updated_at AS updatedAt
       FROM rag_sessions
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId],
    );
    res.json({ ok: true, sessions });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 查询指定会话消息。
 */
app.get("/api/rag/sessions/:sessionId/messages", requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId || "");
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  if (!sessionId) {
    res.status(400).json({ ok: false, message: "sessionId 不能为空" });
    return;
  }
  try {
    const sessionRow = await get("SELECT id FROM rag_sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
    if (!sessionRow) {
      res.status(404).json({ ok: false, message: "会话不存在或无权访问" });
      return;
    }
    const rows = await all(
      `SELECT id, session_id AS sessionId, role, content, references_json AS referencesJson, created_at AS createdAt
       FROM rag_messages
       WHERE session_id = ?
       ORDER BY created_at ASC`,
      [sessionId],
    );
    const messages = rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      role: row.role,
      content: row.content,
      references: (() => {
        try {
          return JSON.parse(row.referencesJson || "[]");
        } catch {
          return [];
        }
      })(),
      createdAt: row.createdAt,
    }));
    res.json({ ok: true, messages });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 删除指定会话及其消息。
 */
app.delete("/api/rag/sessions/:sessionId", requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId || "");
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  if (!sessionId) {
    res.status(400).json({ ok: false, message: "sessionId 不能为空" });
    return;
  }
  try {
    const sessionRow = await get("SELECT id FROM rag_sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
    if (!sessionRow) {
      res.status(404).json({ ok: false, message: "会话不存在或无权删除" });
      return;
    }
    await run("DELETE FROM rag_messages WHERE session_id = ?", [sessionId]);
    await run("DELETE FROM rag_sessions WHERE id = ?", [sessionId]);
    res.json({ ok: true, deleted: true, sessionId });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 纯 LLM 对话接口（支持 SSE 流式返回）。
 * 配置来自环境变量：OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL, CHAT_CONTEXT_LIMIT
 */
app.post("/api/chat/stream", async (req, res) => {
  let userId = DEFAULT_USER_ID;
  const query = String(req.body?.query || "").trim();
  const contextText = String(req.body?.contextText || "").trim();
  let sessionId = String(req.body?.sessionId || "").trim();

  // 优先使用请求体中的配置，如果未提供则回退到环境变量
  const requestEndpoint = String(req.body?.endpoint || "").trim();
  const requestApiKey = String(req.body?.apiKey || "").trim();
  const requestModel = String(req.body?.model || "").trim();
  const requestTemperature = Number(req.body?.temperature);
  const requestTopP = Number(req.body?.topP);
  const requestMaxTokens = Number(req.body?.maxTokens);
  const requestStream = req.body?.stream;
  const requestSystemPrompt = String(req.body?.systemPrompt || "").trim();

  const normalizedEndpoint = requestEndpoint ? requestEndpoint.replace(/\/+$/, "") : OPENAI_BASE_URL;
  const activeBaseUrl = normalizedEndpoint;
  const activeApiKey = requestApiKey || OPENAI_API_KEY;
  const activeModel = requestModel || OPENAI_MODEL;
  const temperature = Number.isFinite(requestTemperature) ? requestTemperature : undefined;
  const topP = Number.isFinite(requestTopP) ? requestTopP : undefined;
  const maxTokens = Number.isFinite(requestMaxTokens) ? Math.max(1, Math.floor(requestMaxTokens)) : undefined;
  const streamEnabled = requestStream !== false;
  const basePrompt = requestSystemPrompt || "你是一个专业的文档分析助手，擅长从文本中提取关键信息并给出清晰解读。";

  if (!query) {
    res.status(400).json({ ok: false, message: "query 不能为空" });
    return;
  }
  if (!activeBaseUrl || !activeApiKey) {
    res.status(400).json({ ok: false, message: "未配置 LLM API 地址或 Key" });
    return;
  }

  // SSE 头部设置
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const token = readBearerToken(req);
    if (token) {
      const row = await get(
        `SELECT t.token, t.user_id AS userId, t.expires_at AS expiresAt
         FROM auth_tokens t
         WHERE t.token = ?`,
        [token],
      );
      if (row && new Date(row.expiresAt).getTime() > Date.now()) {
        userId = String(row.userId || DEFAULT_USER_ID);
      } else if (row && new Date(row.expiresAt).getTime() <= Date.now()) {
        await run("DELETE FROM auth_tokens WHERE token = ?", [token]).catch(() => {});
      }
    }

    // 1. 会话初始化或校验
    const now = new Date().toISOString();
    if (!sessionId) {
      sessionId = createId("session");
      await run(
        "INSERT INTO rag_sessions(id, user_id, title, created_at, updated_at) VALUES(?, ?, ?, ?, ?)",
        [sessionId, userId, query.slice(0, 24) || "新会话", now, now],
      );
      // 发送会话ID给前端（作为第一个 SSE 事件）
      res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    } else {
      const sessionRow = await get("SELECT id FROM rag_sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
      if (!sessionRow) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "会话不存在或无权访问" })}\n\n`);
        res.end();
        return;
      }
    }

    // 2. 保存用户提问
    const userMsgId = createId("msg");
    await run(
      "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
      [userMsgId, sessionId, "user", query, "[]", now],
    );

    // 3. 构建上下文（最近 N 条消息）
    const historyRows = await all(
      `SELECT role, content
       FROM rag_messages
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [sessionId, CHAT_CONTEXT_LIMIT],
    );
    // 按时间正序排列
    const contextMessages = [...historyRows].reverse().map(row => ({
      role: row.role,
      content: row.content
    }));

    // 4. 调用 OpenAI 接口
    const systemPrompt = contextText
      ? `${basePrompt}\n\n文档内容：\n${contextText}`
      : basePrompt;

    const messages = [
      { role: "system", content: systemPrompt },
      ...contextMessages
    ];

    // 如果查询出来的最后一条不是 query（可能因为并发或者其他原因），手动补上。
    // 但正常情况下 await run 之后 await all 应该能读到。
    // 不过，为了避免重复，我们最好明确构造 messages。
    // 上面的查询包含了刚插入的 query（因为 order by created_at desc limit N，query 是最新的）。
    // 所以 messages 列表里应该是: system -> history (oldest...newest, including query).

    const requestBody = {
      model: activeModel,
      messages: messages,
      stream: streamEnabled,
    };
    if (typeof temperature === "number") requestBody.temperature = temperature;
    if (typeof topP === "number") requestBody.top_p = topP;
    if (typeof maxTokens === "number") requestBody.max_tokens = maxTokens;

    const endpointUrl = buildChatCompletionsUrl(activeBaseUrl);
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${activeApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    let accumulatedAnswer = "";
    if (!streamEnabled) {
      const payload = await response.json();
      const content = String(payload?.choices?.[0]?.message?.content || "");
      if (content) {
        accumulatedAnswer = content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    } else {
      if (!response.body) {
        throw new Error("OpenAI API response body is empty");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");
        for (const line of lines) {
          if (line.trim() === "data: [DONE]") continue;
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              const content = data.choices?.[0]?.delta?.content || "";
              if (content) {
                accumulatedAnswer += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              console.error("Error parsing SSE chunk", e);
            }
          }
        }
      }
    }

    // 6. 保存 AI 回答
    if (accumulatedAnswer) {
      const assistantMsgId = createId("msg");
      await run(
        "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
        [assistantMsgId, sessionId, "assistant", accumulatedAnswer, "[]", new Date().toISOString()],
      );
      // 更新会话时间
      await run("UPDATE rag_sessions SET updated_at = ? WHERE id = ?", [new Date().toISOString(), sessionId]);
    }
    
    res.write("event: done\ndata: {}\n\n");
    res.end();

  } catch (error) {
    console.error("Stream Chat Error:", error);
    const errorMessage = String(error?.message || error);
    
    // 尝试保存错误信息到数据库（作为 assistant 的一条错误提示消息，或者仅记录日志）
    // 用户要求 "在消息或者错误时，保存对话消息到sqlite"。这里保存错误消息作为对话一部分可能有助于回溯。
    // 但为了不破坏对话上下文，可能只保存到 error 字段？表结构没有 error 字段。
    // 我们可以插入一条 assistant 消息内容为 "Error: ..."
    try {
      if (sessionId) {
         await run(
          "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
          [createId("msg"), sessionId, "assistant", `[System Error] ${errorMessage}`, "[]", new Date().toISOString()],
        );
      }
    } catch (saveError) {
      console.error("Failed to save error to DB:", saveError);
    }

    // 发送错误给前端
    res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
    res.end();
  }
});

function buildChatCompletionsUrl(baseUrl) {
  const raw = String(baseUrl || "").trim();
  if (!raw) return "";
  if (raw.includes("/chat/completions")) return raw;
  return `${raw.replace(/\/+$/, "")}/chat/completions`;
}

/**
 * 会话型 RAG 对话接口（ChatGPT 风格多轮）。
 */
app.post("/api/rag/chat", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const query = String(req.body?.query || "").trim();
  const fileName = String(req.body?.fileName || "").trim();
  const contextChunks = Array.isArray(req.body?.chunks) ? req.body.chunks : [];
  let sessionId = String(req.body?.sessionId || "").trim();
  if (!query) {
    res.status(400).json({ ok: false, message: "query 不能为空" });
    return;
  }

  try {
    if (!sessionId) {
      sessionId = createId("session");
      const now = new Date().toISOString();
      await run(
        "INSERT INTO rag_sessions(id, user_id, title, created_at, updated_at) VALUES(?, ?, ?, ?, ?)",
        [sessionId, userId, query.slice(0, 24) || "新会话", now, now],
      );
    } else {
      const sessionRow = await get("SELECT id FROM rag_sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
      if (!sessionRow) {
        res.status(404).json({ ok: false, message: "会话不存在或无权访问" });
        return;
      }
    }

    const userMsgId = createId("msg");
    const now = new Date().toISOString();
    await run(
      "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
      [userMsgId, sessionId, "user", query, "[]", now],
    );

    const historyRows = await all(
      `SELECT role, content
       FROM rag_messages
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT 8`,
      [sessionId],
    );
    const recentMessages = [...historyRows].reverse();

    const queryTokens = tokenizeQuery(query);
    const localChunks = contextChunks
      .map((item) => ({
        text: String(item?.text || item?.chunk_text || "").trim(),
        meta: String(item?.meta || item?.metaText || item?.id || "上下文片段"),
      }))
      .filter((item) => item.text)
      .map((item) => ({
        ...item,
        score: scoreChunk(queryTokens, item.text),
      }));

    let dbChunks = [];
    if (localChunks.length < 3 && fileName) {
      const rows = await all(
        `SELECT chunk_text AS text, meta_json AS metaJson
         FROM document_chunks
         WHERE user_id = ? AND file_name = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId, fileName],
      );
      dbChunks = rows.map((row) => {
        let meta = "文档片段";
        try {
          const parsed = JSON.parse(row.metaJson || "{}");
          meta = String(parsed.page || parsed.label || "文档片段");
        } catch {
          meta = "文档片段";
        }
        return {
          text: String(row.text || ""),
          meta,
          score: scoreChunk(queryTokens, row.text || ""),
        };
      });
    }

    const ranked = [...localChunks, ...dbChunks]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const answerResult = buildServerAnswer(query, recentMessages, ranked);

    const assistantMsgId = createId("msg");
    await run(
      "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
      [assistantMsgId, sessionId, "assistant", answerResult.answer, JSON.stringify(answerResult.references), new Date().toISOString()],
    );
    await run("UPDATE rag_sessions SET updated_at = ? WHERE id = ?", [new Date().toISOString(), sessionId]);

    res.json({
      ok: true,
      sessionId,
      answer: answerResult.answer,
      references: answerResult.references,
      source: "server-local",
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * LangGraph Agent 对话接口（OpenAI 兼容模型）。
 */
app.post("/api/agent/chat", requireAuth, async (req, res) => {
  const userId = String(req.authUser?.id || DEFAULT_USER_ID);
  const endpoint = String(req.body?.endpoint || "").trim();
  const apiKey = String(req.body?.apiKey || "").trim();
  const model = String(req.body?.model || "").trim();
  const query = String(req.body?.query || "").trim();
  const contextText = String(req.body?.contextText || "").trim();
  let sessionId = String(req.body?.sessionId || "").trim();
  const title = String(req.body?.title || "新会话").trim();
  if (!endpoint || !apiKey || !model || !query) {
    res.status(400).json({ ok: false, message: "endpoint、apiKey、model、query 不能为空" });
    return;
  }
  if (!/^https?:\/\//i.test(endpoint)) {
    res.status(400).json({ ok: false, message: "endpoint 必须是有效 http/https 地址" });
    return;
  }
  try {
    if (!sessionId) {
      sessionId = createId("session");
      const now = new Date().toISOString();
      await run(
        "INSERT INTO rag_sessions(id, user_id, title, created_at, updated_at) VALUES(?, ?, ?, ?, ?)",
        [sessionId, userId, title || "新会话", now, now],
      );
    } else {
      const sessionRow = await get("SELECT id FROM rag_sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
      if (!sessionRow) {
        res.status(404).json({ ok: false, message: "会话不存在或无权访问" });
        return;
      }
    }
    await run(
      "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
      [createId("msg"), sessionId, "user", query, "[]", new Date().toISOString()],
    );
    const result = await invokeLangGraphAgent({
      endpoint,
      apiKey,
      model,
      query,
      contextText,
    });
    if (!result || !result.ok || !String(result.answer || "").trim()) {
      res.status(502).json({ ok: false, message: "LangGraph Agent 未返回有效内容" });
      return;
    }
    await run(
      "INSERT INTO rag_messages(id, session_id, role, content, references_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
      [createId("msg"), sessionId, "assistant", result.answer, "[]", new Date().toISOString()],
    );
    await run("UPDATE rag_sessions SET updated_at = ? WHERE id = ?", [new Date().toISOString(), sessionId]);
    res.json({ ok: true, answer: result.answer, sessionId });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error?.message || error) });
  }
});

/**
 * 自定义模型对话代理接口（OpenAI 兼容）。
 */
app.post("/api/model/chat", requireAuth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || "").trim();
  const apiKey = String(req.body?.apiKey || "").trim();
  const model = String(req.body?.model || "").trim();
  const query = String(req.body?.query || "").trim();
  const contextText = String(req.body?.contextText || "").trim();
  if (!endpoint || !apiKey || !model || !query) {
    res.status(400).json({ ok: false, message: "endpoint、apiKey、model、query 不能为空" });
    return;
  }
  if (!/^https?:\/\//i.test(endpoint)) {
    res.status(400).json({ ok: false, message: "endpoint 必须是有效 http/https 地址" });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const payload = {
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "你是一个中文学习助手，请基于提供的上下文进行简洁、准确回答。",
        },
        {
          role: "user",
          content: contextText
            ? `学习上下文如下：\n${contextText}\n\n用户问题：${query}`
            : query,
        },
      ],
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(502).json({
        ok: false,
        message: String(data?.error?.message || data?.message || `模型接口请求失败（${response.status}）`),
      });
      return;
    }
    const answer = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!answer) {
      res.status(502).json({ ok: false, message: "模型返回为空，请检查接口协议是否兼容 OpenAI Chat Completions" });
      return;
    }
    res.json({ ok: true, answer });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "模型请求超时，请检查接口可用性"
      : String(error?.message || error);
    res.status(500).json({ ok: false, message });
  } finally {
    clearTimeout(timeout);
  }
});

/**
 * 统一处理上传中间件错误，返回可读 JSON。
 */
app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ ok: false, message: `文件过大，单文件最大 ${RAG_UPLOAD_MAX_FILE_MB}MB` });
      return;
    }
    res.status(400).json({ ok: false, message: `上传失败：${error.message}` });
    return;
  }
  next(error);
});

initDb()
  .then(() => {
    startBackupScheduler();
    void cleanupOldBackups();
    app.listen(PORT, HOST, () => {
      // eslint-disable-next-line no-console
      console.log(`[ClawMind] backend running at http://${HOST}:${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`[ClawMind] frontend running at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[ClawMind] init failed:", error);
    process.exit(1);
  });

/**
 * 优雅退出：退出前尝试做一次收尾备份。
 * @param {string} signal 信号名称。
 */
function handleProcessExit(signal) {
  void createDbBackup("shutdown")
    .then(() => {
      // eslint-disable-next-line no-console
      console.log(`[ClawMind] ${signal} received, backup completed.`);
      process.exit(0);
    })
    .catch(() => {
      process.exit(0);
    });
}

process.on("SIGINT", () => handleProcessExit("SIGINT"));
process.on("SIGTERM", () => handleProcessExit("SIGTERM"));
