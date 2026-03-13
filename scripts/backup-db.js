const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "clawmind.db");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

/**
 * 生成文件系统安全的时间戳字符串。
 * @returns {string} 时间戳文本。
 */
function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * 确保备份目录存在。
 */
function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * 执行 SQLite 主库文件备份。
 */
function runBackup() {
  ensureBackupDir();
  if (!fs.existsSync(DB_PATH)) {
    // eslint-disable-next-line no-console
    console.error(`[ClawMind] 数据库不存在: ${DB_PATH}`);
    process.exit(1);
  }
  const target = path.join(BACKUP_DIR, `clawmind-manual-${buildTimestamp()}.db`);
  fs.copyFileSync(DB_PATH, target);
  // eslint-disable-next-line no-console
  console.log(`[ClawMind] 备份完成: ${target}`);
}

runBackup();
