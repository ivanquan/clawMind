const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const ENV_FILE_PATH = path.join(ROOT_DIR, ".env");
const FRONTEND_CONFIG_PATH = path.join(ROOT_DIR, "clawmind.config.js");

/**
 * 解析 .env 文本为键值对象。
 * @param {string} content .env 文件内容。
 * @returns {Record<string, string>} 解析结果。
 */
function parseEnv(content) {
  const result = {};
  String(content || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const text = String(line || "").trim();
      if (!text || text.startsWith("#")) return;
      const idx = text.indexOf("=");
      if (idx <= 0) return;
      const key = text.slice(0, idx).trim();
      const value = text.slice(idx + 1).trim();
      if (key) result[key] = value;
    });
  return result;
}

/**
 * 将键值对象序列化为 .env 文本。
 * @param {Record<string, string|number>} envMap 环境变量映射。
 * @returns {string} 序列化文本。
 */
function toEnvText(envMap) {
  const lines = [
    "# ClawMind deployment profile (generated)",
    `# generatedAt=${new Date().toISOString()}`,
  ];
  Object.keys(envMap).forEach((key) => {
    lines.push(`${key}=${String(envMap[key])}`);
  });
  return `${lines.join("\n")}\n`;
}

/**
 * 判断 IPv4 是否为常见私有网段地址。
 * @param {string} ip IPv4 地址。
 * @returns {boolean} 是否私有网段。
 */
function isPrivateIpv4(ip) {
  const value = String(ip || "");
  return /^10\./.test(value) || /^192\.168\./.test(value) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);
}

/**
 * 获取本机可用 IPv4 地址（优先私有网段）。
 * @returns {string} IPv4 地址，找不到则返回 127.0.0.1。
 */
function detectLanIp() {
  const net = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(net)) {
    const list = net[name] || [];
    for (const item of list) {
      if (item && item.family === "IPv4" && !item.internal) {
        candidates.push(item.address);
      }
    }
  }
  const privateIp = candidates.find((ip) => isPrivateIpv4(ip));
  if (privateIp) return privateIp;
  if (candidates.length > 0) return candidates[0];
  return "127.0.0.1";
}

/**
 * 根据部署模式构建前端运行时配置。
 * @param {"local-lan"|"server"} mode 部署模式。
 * @param {string} lanIp 局域网 IP。
 * @returns {{deploymentMode:string,apiBaseUrl:string}} 配置对象。
 */
function buildFrontendConfig(mode, lanIp) {
  if (mode === "server") {
    return {
      deploymentMode: "server",
      apiBaseUrl: "/api",
    };
  }
  return {
    deploymentMode: "local-lan",
    apiBaseUrl: `http://${lanIp}:8787/api`,
  };
}

/**
 * 根据部署模式构建后端环境变量配置。
 * @param {"local-lan"|"server"} mode 部署模式。
 * @param {string} lanIp 局域网 IP。
 * @param {Record<string, string>} existingEnv 现有 .env 配置。
 * @returns {Record<string, string|number>} 环境变量映射。
 */
function buildBackendEnv(mode, lanIp, existingEnv) {
  const manualToken = existingEnv.MANUAL_BACKUP_TOKEN || "";
  const defaults = {
    PORT: 8787,
    ENABLE_ACCESS_LOG: "true",
    BACKUP_INTERVAL_MINUTES: 360,
    BACKUP_RETENTION_DAYS: 7,
    RAG_INGEST_MAX_CHUNKS: 300,
    RAG_INGEST_CHUNK_SIZE: 1000,
    RAG_INGEST_CHUNK_OVERLAP: 120,
    RAG_UPLOAD_MAX_FILE_MB: 20,
    MANUAL_BACKUP_TOKEN: manualToken,
  };
  if (mode === "server") {
    return {
      ...defaults,
      HOST: "127.0.0.1",
      CORS_ALLOWLIST: "https://clawmind.example.com",
    };
  }
  return {
    ...defaults,
    HOST: "0.0.0.0",
    CORS_ALLOWLIST: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      `http://${lanIp}:5500`,
    ].join(","),
  };
}

/**
 * 将前端配置写入 clawmind.config.js 文件。
 * @param {{deploymentMode:string,apiBaseUrl:string}} config 前端配置。
 */
function writeFrontendConfig(config) {
  const payload = `window.ClawMindConfig = ${JSON.stringify(
    {
      ...config,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  )};\n`;
  fs.writeFileSync(FRONTEND_CONFIG_PATH, payload, "utf8");
}

/**
 * 将后端环境变量写入 .env 文件。
 * @param {Record<string, string|number>} envMap 环境变量映射。
 */
function writeBackendEnv(envMap) {
  fs.writeFileSync(ENV_FILE_PATH, toEnvText(envMap), "utf8");
}

/**
 * 读取现有 .env 文件（不存在时返回空对象）。
 * @returns {Record<string, string>} 已有环境变量映射。
 */
function readExistingEnv() {
  if (!fs.existsSync(ENV_FILE_PATH)) return {};
  const content = fs.readFileSync(ENV_FILE_PATH, "utf8");
  return parseEnv(content);
}

/**
 * 执行部署模式切换。
 * @param {"local-lan"|"server"} mode 部署模式。
 */
function switchDeployMode(mode, lanIpFromArg) {
  const lanIp = lanIpFromArg || process.env.CLAWMIND_LAN_IP || detectLanIp();
  const existingEnv = readExistingEnv();
  const frontendConfig = buildFrontendConfig(mode, lanIp);
  const backendEnv = buildBackendEnv(mode, lanIp, existingEnv);
  writeFrontendConfig(frontendConfig);
  writeBackendEnv(backendEnv);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        lanIp,
        frontendConfigPath: FRONTEND_CONFIG_PATH,
        envPath: ENV_FILE_PATH,
        apiBaseUrl: frontendConfig.apiBaseUrl,
      },
      null,
      2,
    ),
  );
}

/**
 * 程序入口：读取命令行参数并执行切换。
 */
function main() {
  const mode = String(process.argv[2] || "local-lan").trim();
  const lanIpFromArg = String(process.argv[3] || "").trim();
  if (mode !== "local-lan" && mode !== "server") {
    // eslint-disable-next-line no-console
    console.error("Usage: node scripts/switch-deploy.js <local-lan|server> [lanIp]");
    process.exit(1);
  }
  switchDeployMode(mode, lanIpFromArg);
}

main();
