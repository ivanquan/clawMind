const DEFAULT_QUESTION_CATEGORIES = ["英语每日短语学习", "英语每日新词", "安卓逆向", "Vibe Coding"];

const appState = {
  currentPage: "dashboard",
  currentTab: "notes",
  currentDocPage: 1,
  totalDocPages: 1,
  currentMonthDate: new Date(2026, 2, 1),
  selectedCalendarDate: "",
  themeMode: "light",
  themeColor: "#e94560",
  autoSyncQuestionBank: true,
  autoSyncMaxPerSave: 5,
  librarySortBy: "learned_desc",
  libraryStatusFilter: "all",
  libraryPage: 1,
  libraryPageSize: 12,
  questionSourceFilter: "all",
  llmEnabled: false,
  llmEndpoint: "",
  llmModel: "",
  llmApiKey: "",
  llmTemperature: 0.7,
  llmTopP: 1,
  llmMaxTokens: 1024,
  llmStream: true,
  llmSystemPrompt: "你是一个专业的文档分析助手，擅长从文本中提取关键信息并给出清晰解读。",
  selectedCategoryId: "",
  activeFileId: "",
  collapsedCategoryIds: [],
  lastExtractItems: [],
  authModalMode: "login",
  questionCategories: [...DEFAULT_QUESTION_CATEGORIES],
  dailyQuotes: [
    "坚持不是一口气冲到底，而是每天都不放弃。",
    "你今天的学习，会成为明天的底气。",
    "慢一点没关系，关键是持续向前。",
    "每次复习，都是在给未来的自己铺路。",
    "把难点拆小，每天攻克一点点。",
  ],
  libraryCategories: [],
  libraryFiles: [],
  workspaceData: {},
  todayTodos: [],
  todayTodosByDate: {},
  scheduleTasks: [],
  learningRecords: [],
  questionBank: [],
  librarySelectionEnabled: false,
  selectedFileIds: [],
  taskPage: 1,
  taskPageSize: 10,
  notesPage: 1,
  notesPageSize: 10,
  notesSearchQuery: "",
  notesSort: "newest",
  notesSelectionEnabled: false,
  selectedNoteIds: [],
  vocabPage: 1,
  vocabPageSize: 10,
  randomPage: 1,
  randomMode: "random",
  yearGoals: [],
  quarterGoals: [],
  goalKrs: [],
  goalTaskLinks: [],
  krTaskLinks: [],
  quarterReviews: [],
  selectedGoalPeriod: "",
  selectedQuarterGoalId: "",
  goalTaskFilter: "all",
  goalTaskSort: "time",
  workspaceViewMode: "original",
  workspacePdfZoom: 120,
  workspaceBrushMode: "free",
  workspaceBrushColor: "#1a1a2e",
  highlightColor: "yellow",
  highlightStyle: "fill",
  onboarding: {
    isNewUser: false,
    globalDone: false,
    pageSeen: {},
  },
};

const runtimeState = {
  db: null,
  chatController: null,
  backend: {
    available: false,
    syncing: false,
    syncTimer: null,
    probing: false,
  },
  rag: {
    userId: "",
    sessionId: "",
    sessions: [],
  },
  vocabModal: {
    mode: "create",
    editingId: "",
  },
  renameCategoryModal: {
    categoryId: "",
  },
  dialog: {
    resolver: null,
  },
  auth: {
    token: "",
    user: null,
    unauthorizedNotified: false,
    justRegistered: false,
  },
  pdf: {
    docCache: {},
    renderToken: 0,
  },
  onboarding: {
    active: false,
    steps: [],
    index: 0,
    onFinish: null,
  },
  ui: {
    zoomTipShown: false,
    zoomTimer: null,
    workspaceBrushOn: false,
    workspaceTextMode: false,
  },
  chat: {
    lastModelError: "",
  },
  upload: {
    busy: false,
  },
  taskEdit: {
    mode: "create",
    taskId: "",
    seriesId: "",
  },
  todoEditIndex: undefined,
  extract: {
    selectedNoteIds: [],
    selectedVocabIds: [],
  },
  goalModal: {
    mode: "create",
    type: "year",
    goalId: "",
  },
  krModal: {
    mode: "create",
    krId: "",
    goalId: "",
  },
  krTaskModal: {
    krId: "",
  },
  goalTaskModal: {
    goalId: "",
  },
};

const HIGHLIGHT_COLORS = {
  yellow: { label: "黄色", rgba: "rgba(255, 241, 115, 0.68)" },
  green: { label: "绿色", rgba: "rgba(158, 247, 168, 0.62)" },
  blue: { label: "蓝色", rgba: "rgba(159, 210, 255, 0.62)" },
  pink: { label: "粉色", rgba: "rgba(255, 183, 216, 0.62)" },
};

const HIGHLIGHT_STYLES = {
  fill: { label: "色块模式" },
  underline: { label: "下划线模式" },
};

const DEFAULT_STARTER_FILE_TAG = "default-backend";

/**
 * 配置 PDF.js worker，提高 PDF 解析性能。
 */
function configurePdfWorker() {
  if (typeof window.pdfjsLib === "undefined") return;
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
}

/**
 * 打开 IndexedDB，用于存储上传的 PDF 二进制文件。
 * @returns {Promise<IDBDatabase|null>} 数据库对象。
 */
function openPdfDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open("ClawMindPdfDB", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("pdfFiles")) {
        db.createObjectStore("pdfFiles", { keyPath: "fileId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * 将 PDF 文件写入 IndexedDB。
 * @param {string} fileId 文件 id。
 * @param {File|Blob} file PDF 文件对象。
 * @returns {Promise<boolean>} 是否写入成功。
 */
function savePdfBlob(fileId, file) {
  return new Promise((resolve) => {
    if (!runtimeState.db) {
      resolve(false);
      return;
    }
    const tx = runtimeState.db.transaction("pdfFiles", "readwrite");
    tx.objectStore("pdfFiles").put({ fileId, blob: file, updatedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/**
 * 从 IndexedDB 读取 PDF 文件。
 * @param {string} fileId 文件 id。
 * @returns {Promise<Blob|null>} PDF 二进制。
 */
function getPdfBlob(fileId) {
  return new Promise((resolve) => {
    if (!runtimeState.db) {
      resolve(null);
      return;
    }
    const tx = runtimeState.db.transaction("pdfFiles", "readonly");
    const req = tx.objectStore("pdfFiles").get(fileId);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => resolve(null);
  });
}

/**
 * 从 IndexedDB 删除 PDF 文件。
 * @param {string} fileId 文件 id。
 * @returns {Promise<void>} 删除流程。
 */
function deletePdfBlob(fileId) {
  return new Promise((resolve) => {
    if (!runtimeState.db) {
      resolve();
      return;
    }
    const tx = runtimeState.db.transaction("pdfFiles", "readwrite");
    tx.objectStore("pdfFiles").delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * 清理 PDF 文档缓存，避免删除文件后仍引用旧文档实例。
 * @param {string} fileId 文件 id。
 */
function clearPdfDocCache(fileId) {
  if (!fileId) return;
  delete runtimeState.pdf.docCache[fileId];
}

async function ensureStarterContentForNewUser() {
  const isEmpty = appState.libraryFiles.length === 0;
  if (!isEmpty) return;
  if (!runtimeState.auth.user?.id) return;
  const info = await fetchDefaultStarterInfo();
  if (info?.available) {
    const injected = await injectStarterPdfFromBackend(info);
    if (injected) return;
  }
  await injectFallbackStarterPdf();
}

async function fetchDefaultStarterInfo() {
  if (!runtimeState.auth.token) return null;
  const result = await requestApi("/library/default-file");
  if (!result || result.ok === false) return null;
  return result;
}

async function fetchDefaultStarterBlob() {
  const base = getApiBaseUrl();
  const headers = new Headers();
  if (runtimeState.auth.token) {
    headers.set("Authorization", `Bearer ${runtimeState.auth.token}`);
  }
  const response = await fetch(`${base}/library/default-file/content`, { headers });
  if (!response.ok) return null;
  return response.blob().catch(() => null);
}

function hasDefaultStarterFile() {
  return appState.libraryFiles.some((file) => file.sourceTag === DEFAULT_STARTER_FILE_TAG);
}

async function injectStarterPdfFromBackend(info) {
  if (!info?.available) return false;
  if (hasDefaultStarterFile()) return true;
  const blob = await fetchDefaultStarterBlob();
  if (!blob || blob.size === 0) return false;
  return await persistStarterPdf({
    blob,
    name: String(info?.name || "默认学习资料"),
    sourceTag: DEFAULT_STARTER_FILE_TAG,
  });
}

async function injectFallbackStarterPdf() {
  const starterBlob = buildStarterPdfBlob();
  return await persistStarterPdf({
    blob: starterBlob,
    name: "ClawMind 新手示例",
    sourceTag: "fallback",
  });
}

async function persistStarterPdf({ blob, name, sourceTag }) {
  if (!blob) return false;
  let starterCategory = appState.libraryCategories.find((cat) => cat.name === "新手引导");
  if (!starterCategory) {
    starterCategory = {
      id: `cat-starter-${Date.now()}`,
      name: "新手引导",
      icon: "🚀",
      parentId: null,
    };
    appState.libraryCategories.push(starterCategory);
  }
  const fileId = `file-starter-${Date.now()}`;
  await savePdfBlob(fileId, blob);
  appState.libraryFiles.push({
    id: fileId,
    name,
    type: "PDF",
    size: `${Math.max(1, Math.round(blob.size / 1024))}KB`,
    pages: "1页",
    addedAt: new Date().toISOString().split("T")[0],
    categoryId: starterCategory.id,
    lastOpenedAt: "",
    completed: false,
    completedAt: "",
    sourceTag,
  });
  const pages = await extractPdfPagesFromFile(blob);
  appState.workspaceData[fileId] = {
    pages: pages.length > 0 ? pages : [{ html: `<p>${escapeHtml(name)}</p>`, highlights: [], marginNotes: [] }],
    notes: [],
    vocab: [],
    savedAt: null,
  };
  appState.selectedCategoryId = starterCategory.id;
  appState.activeFileId = fileId;
  appState.currentDocPage = 1;
  appState.totalDocPages = Math.max(1, appState.workspaceData[fileId].pages.length);
  persistLocalState();
  return true;
}

function buildStarterPdfBlob() {
  const text1 = "ClawMind Starter PDF";
  const text2 = "1) 在图书馆上传你的第一份资料";
  const text3 = "2) 在工作区选中文本，做高亮和笔记";
  const text4 = "3) 在日程中心安排复习节奏";
  const streamText = `BT /F1 22 Tf 72 760 Td (${escapePdfText(text1)}) Tj ET\nBT /F1 14 Tf 72 720 Td (${escapePdfText(text2)}) Tj ET\nBT /F1 14 Tf 72 695 Td (${escapePdfText(text3)}) Tj ET\nBT /F1 14 Tf 72 670 Td (${escapePdfText(text4)}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${new TextEncoder().encode(streamText).length} >>\nstream\n${streamText}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += obj;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function escapePdfText(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * 初始化应用并渲染所有核心模块。
 */
async function initApp() {
  configurePdfWorker();
  runtimeState.db = await openPdfDb();
  restoreAuthState();
  await refreshAuthUser();
  if (!runtimeState.auth.user?.id) {
    resetUserScopedState();
    localStorage.removeItem(getUserScopedStateStorageKey());
  }
  restoreLocalState();
  await hydrateStateFromBackend();
  await ensureStarterContentForNewUser();
  normalizeWorkspaceData();
  normalizeLibraryFilesCategory();
  normalizeQuestionBankItems();
  normalizeQuestionCategories();
  if (!appState.selectedCalendarDate) {
    appState.selectedCalendarDate = toLocalDateString(new Date());
  }
  applyThemeMode(appState.themeMode);
  applyThemeColor(appState.themeColor);
  bindNavigation();
  bindTabSwitch();
  bindUploadArea();
  bindWorkspaceZoomWheel();
  bindGlobalFileDrop();
  bindEnterToSend();
  bindCategoryTreeClick();
  bindWorkspaceFileSelect();
  bindThemeColorPicker();
  bindAppearanceModeToggle();
  bindModalCommonEvents();
  bindLibraryFilterControls();
  bindQuestionBankFilterControls();
  bindAutoSyncSettings();
  bindModelSettings();
  bindAuthEnterSubmit();
  await refreshUiFromState();
  maybeStartGlobalOnboarding();
  await refreshChatSessions(true);
  if (runtimeState.rag.sessionId) {
    await loadChatSessionMessages(runtimeState.rag.sessionId);
  }
}

/**
 * 基于当前内存状态刷新主要页面展示。
 */
async function refreshUiFromState() {
  renderDailyQuote();
  renderHeatmap();
  renderContinueLearning();
  renderTodayTodos();
  renderLibraryCategoryTree();
  renderLibraryFiles();
  renderTaskList();
  renderCalendar();
  renderReviewTimeline();
  renderQuestionCategoryOptions();
  renderQuestionFormCategoryOptions();
  renderQuestionBankSummary();
  renderChatWelcomeMessage();
  syncAuthUi();
  populateUploadCategoryOptions();
  populateWorkspaceFileOptions();
  syncHighlightColorPicker();
  syncHighlightStylePicker();
  await loadActiveWorkspaceFile();
  syncPageIndicator();
  updateStats();
  maybeShowDailyFeedbackBanner();
}

/**
 * 绑定全局弹窗公共交互：点击遮罩关闭、Esc 关闭。
 */
function bindModalCommonEvents() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal && modal.id) {
        if (modal.id === "app-dialog-modal") {
          cancelAppDialog();
        } else {
          closeModal(modal.id);
        }
      }
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const opened = document.querySelector(".modal.show");
    if (!opened || !(opened instanceof HTMLElement) || !opened.id) return;
    if (opened.id === "app-dialog-modal") {
      cancelAppDialog();
    } else {
      closeModal(opened.id);
    }
  });
}

/**
 * 从本地恢复登录令牌。
 */
function restoreAuthState() {
  const token = localStorage.getItem("clawmind-auth-token");
  runtimeState.auth.token = typeof token === "string" ? token.trim() : "";
  const rawUser = localStorage.getItem("clawmind-auth-user");
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      if (user && typeof user.id === "string" && typeof user.username === "string") {
        runtimeState.auth.user = { id: user.id, username: user.username };
      }
    } catch {
    }
  }
}

/**
 * 计算当前用户对应的本地状态存储 key。
 * @returns {string} localStorage key。
 */
function getUserScopedStateStorageKey() {
  const userId = runtimeState.auth.user?.id || "guest";
  return `clawmind-ui-state:${userId}`;
}

/**
 * 重置用户相关数据，避免账号切换时出现串数据。
 */
function resetUserScopedState() {
  appState.selectedCategoryId = "";
  appState.activeFileId = "";
  appState.collapsedCategoryIds = [];
  appState.lastExtractItems = [];
  appState.libraryCategories = [];
  appState.libraryFiles = [];
  appState.workspaceData = {};
  appState.todayTodos = [];
  appState.todayTodosByDate = {};
  appState.scheduleTasks = [];
  appState.learningRecords = [];
  appState.questionBank = [];
  appState.questionCategories = [...DEFAULT_QUESTION_CATEGORIES];
  appState.selectedCalendarDate = toLocalDateString(new Date());
  appState.yearGoals = [];
  appState.quarterGoals = [];
  appState.goalKrs = [];
  appState.goalTaskLinks = [];
  appState.krTaskLinks = [];
  appState.quarterReviews = [];
  appState.selectedGoalPeriod = "";
  appState.selectedQuarterGoalId = "";
  appState.goalTaskFilter = "all";
  appState.goalTaskSort = "time";
  appState.currentDocPage = 1;
  appState.totalDocPages = 1;
  runtimeState.rag.sessionId = "";
  runtimeState.rag.sessions = [];
  localStorage.removeItem("clawmind-rag-session-id");
}

/**
 * 持久化当前登录令牌。
 */
function persistAuthState() {
  if (runtimeState.auth.token) {
    localStorage.setItem("clawmind-auth-token", runtimeState.auth.token);
    if (runtimeState.auth.user?.id) {
      localStorage.setItem("clawmind-auth-user", JSON.stringify(runtimeState.auth.user));
      localStorage.setItem("clawmind-auth-username", runtimeState.auth.user.username || "");
    }
  } else {
    localStorage.removeItem("clawmind-auth-token");
    localStorage.removeItem("clawmind-auth-user");
    localStorage.removeItem("clawmind-auth-username");
  }
}

/**
 * 清空当前登录态。
 * @param {boolean} silent 是否静默清空（不弹提示）。
 */
function clearAuthState(silent = false) {
  runtimeState.auth.token = "";
  runtimeState.auth.user = null;
  resetUserScopedState();
  persistAuthState();
  syncAuthUi();
  renderChatSessionOptions();
  persistLocalState();
  void refreshUiFromState();
  if (!silent) {
    showAppAlert("登录状态已失效，请重新登录。", "登录失效");
  }
}

/**
 * 处理接口 401 状态。
 */
function handleUnauthorized() {
  if (runtimeState.auth.unauthorizedNotified) return;
  runtimeState.auth.unauthorizedNotified = true;
  clearAuthState(true);
  showAppAlert("登录已过期，请重新登录后继续使用在线能力。", "需要登录");
  setTimeout(() => {
    runtimeState.auth.unauthorizedNotified = false;
  }, 1200);
}

/**
 * 向后端查询当前登录用户。
 * @returns {Promise<boolean>} 是否登录有效。
 */
async function refreshAuthUser() {
  if (!runtimeState.auth.token) {
    runtimeState.auth.user = null;
    syncAuthUi();
    return false;
  }
  const result = await requestApi("/auth/me");
  if (!result || !result.ok || !result.user) {
    clearAuthState(true);
    return false;
  }
  runtimeState.auth.user = {
    id: String(result.user.id || ""),
    username: String(result.user.username || "用户"),
  };
  runtimeState.rag.userId = runtimeState.auth.user.id;
  syncAuthUi();
  return true;
}

/**
 * 根据登录状态更新侧边栏显示。
 */
function syncAuthUi() {
  const nameEl = document.getElementById("user-name-display");
  const actionBtn = document.getElementById("auth-action-btn");
  const welcomeEl = document.getElementById("welcome-username");
  const user = runtimeState.auth.user;
  const username = user?.username || localStorage.getItem("clawmind-auth-username") || "攀登者";
  if (nameEl) {
    nameEl.textContent = user?.username || "未登录";
  }
  if (welcomeEl) {
    welcomeEl.textContent = username;
  }
  if (actionBtn) {
    actionBtn.textContent = user ? "退出登录" : "登录";
  }
}

/**
 * 处理侧边栏登录/退出按钮。
 */
function handleAuthAction() {
  if (runtimeState.auth.user) {
    void logoutCurrentUser();
    return;
  }
  openAuthModal("login");
}

/**
 * 打开登录或注册弹窗。
 * @param {"login"|"register"} mode 当前模式。
 */
function openAuthModal(mode = "login") {
  appState.authModalMode = mode;
  const cachedName = localStorage.getItem("clawmind-auth-username");
  const defaultName = runtimeState.auth.user?.username || cachedName || "local-user";
  setValue("auth-username-input", appState.authModalMode === "login" ? defaultName : "");
  setValue("auth-password-input", "");
  setAuthModalMessage("");
  syncAuthModalText();
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 切换登录弹窗模式。
 */
function toggleAuthMode() {
  appState.authModalMode = appState.authModalMode === "login" ? "register" : "login";
  setAuthModalMessage("");
  syncAuthModalText();
}

/**
 * 同步登录弹窗标题与提示文案。
 */
function syncAuthModalText() {
  const title = document.getElementById("auth-modal-title");
  const tip = document.getElementById("auth-modal-tip");
  const toggleBtn = document.getElementById("auth-toggle-btn");
  if (title) {
    title.textContent = appState.authModalMode === "login" ? "🔐 账号登录" : "🆕 创建账号";
  }
  if (tip) {
    tip.textContent = appState.authModalMode === "login"
      ? "使用你的账号登录后，可启用后端同步与会话 RAG。"
      : "注册后会自动登录当前账号。";
  }
  if (toggleBtn) {
    toggleBtn.textContent = appState.authModalMode === "login" ? "切换为注册" : "切换为登录";
  }
}

function setAuthModalMessage(message) {
  const el = document.getElementById("auth-modal-error");
  if (!el) return;
  const text = String(message || "").trim();
  if (!text) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.style.display = "block";
}

/**
 * 提交登录/注册表单。
 */
async function submitAuthModal() {
  const isRegisterMode = appState.authModalMode === "register";
  const username = getValue("auth-username-input");
  const password = getValue("auth-password-input");
  if (!username || !password) {
    setAuthModalMessage("用户名和密码不能为空。");
    return;
  }
  if (appState.authModalMode === "register" && password.length < 6) {
    setAuthModalMessage("注册密码至少 6 位。");
    return;
  }
  setAuthModalMessage("");
  const endpoint = appState.authModalMode === "login" ? "/auth/login" : "/auth/register";
  const result = await requestApi(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!result || !result.ok || !result.auth?.token || !result.user) {
    setAuthModalMessage(String(result?.message || "登录/注册失败，请检查账号信息后重试。"));
    return;
  }
  runtimeState.auth.token = String(result.auth.token);
  runtimeState.auth.user = {
    id: String(result.user.id || ""),
    username: String(result.user.username || username),
  };
  runtimeState.auth.justRegistered = isRegisterMode;
  runtimeState.rag.userId = runtimeState.auth.user.id;
  if (isRegisterMode) {
    appState.onboarding.isNewUser = true;
    appState.onboarding.globalDone = false;
    appState.onboarding.pageSeen = {};
  }
  resetUserScopedState();
  restoreLocalState();
  persistAuthState();
  closeModal("auth-modal");
  await hydrateStateFromBackend();
  normalizeWorkspaceData();
  normalizeLibraryFilesCategory();
  normalizeQuestionBankItems();
  normalizeQuestionCategories();
  await refreshChatSessions(true);
  await refreshUiFromState();
  if (runtimeState.rag.sessionId) {
    await loadChatSessionMessages(runtimeState.rag.sessionId);
  }
  const shouldGuide = Boolean(appState.onboarding.isNewUser && !appState.onboarding.globalDone);
  if (shouldGuide) {
    setTimeout(() => {
      maybeStartGlobalOnboarding();
    }, 120);
  } else {
    showAppAlert("登录成功，后端同步已启用。", "登录成功");
  }
}

/**
 * 退出当前账号并清理本地登录态。
 */
async function logoutCurrentUser() {
  await requestApi("/auth/logout", { method: "POST" });
  clearAuthState(true);
  showAppAlert("已退出登录。", "账号");
}

/**
 * 绑定登录弹窗回车提交。
 */
function bindAuthEnterSubmit() {
  const userInput = document.getElementById("auth-username-input");
  const passInput = document.getElementById("auth-password-input");
  [userInput, passInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submitAuthModal();
      }
    });
  });
}

/**
 * 获取后端 API 基地址。
 * @returns {string} API 基地址。
 */
function getApiBaseUrl() {
  const fromConfig = window.ClawMindConfig?.apiBaseUrl;
  if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim().replace(/\/$/, "");
  const fromLocal = localStorage.getItem("clawmind-api-base");
  if (typeof fromLocal === "string" && fromLocal.trim()) return fromLocal.trim().replace(/\/$/, "");
  const origin = String(window.location.origin || "").trim();
  if (origin.startsWith("http")) {
    return `${origin}/api`;
  }
  return "http://127.0.0.1:8787/api";
}

/**
 * 调用后端 API（失败时返回 null，避免阻塞前端流程）。
 * @param {string} path API 路径。
 * @param {RequestInit} options 请求配置。
 * @returns {Promise<any|null>} 接口返回数据。
 */
async function requestApi(path, options = {}) {
  const base = getApiBaseUrl();
  try {
    const headers = new Headers(options.headers || {});
    if (runtimeState.auth.token) {
      headers.set("Authorization", `Bearer ${runtimeState.auth.token}`);
    }
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers,
    });
    if (
      response.status === 401
      && path !== "/auth/login"
      && path !== "/auth/register"
    ) {
      handleUnauthorized();
      return null;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: String(data?.message || `请求失败（${response.status}）`),
      };
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * 获取当前 RAG 用户 id（默认本地用户）。
 * @returns {string} 用户 id。
 */
function getRagUserId() {
  if (runtimeState.auth.user?.id) {
    runtimeState.rag.userId = String(runtimeState.auth.user.id);
    return runtimeState.rag.userId;
  }
  if (runtimeState.rag.userId) return runtimeState.rag.userId;
  const fromLocal = localStorage.getItem("clawmind-rag-user-id");
  if (typeof fromLocal === "string" && fromLocal.trim()) {
    runtimeState.rag.userId = fromLocal.trim();
    return runtimeState.rag.userId;
  }
  runtimeState.rag.userId = "local-user";
  localStorage.setItem("clawmind-rag-user-id", runtimeState.rag.userId);
  return runtimeState.rag.userId;
}

/**
 * 获取当前 RAG 会话 id，若不存在则自动创建。
 * @returns {Promise<string>} 会话 id。
 */
async function getOrCreateRagSessionId() {
  if (!runtimeState.auth.user?.id) return "";
  if (runtimeState.rag.sessionId) return runtimeState.rag.sessionId;
  const fromLocal = localStorage.getItem("clawmind-rag-session-id");
  if (typeof fromLocal === "string" && fromLocal.trim()) {
    runtimeState.rag.sessionId = fromLocal.trim();
    return runtimeState.rag.sessionId;
  }
  const result = await requestApi("/rag/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: getRagUserId(),
      title: "默认会话",
    }),
  });
  if (!result || !result.ok || !result.session?.id) return "";
  runtimeState.rag.sessionId = String(result.session.id);
  localStorage.setItem("clawmind-rag-session-id", runtimeState.rag.sessionId);
  return runtimeState.rag.sessionId;
}

/**
 * 渲染聊天会话下拉框选项。
 */
function renderChatSessionOptions() {
  const select = document.getElementById("chat-session-select");
  if (!select) return;
  const sessions = Array.isArray(runtimeState.rag.sessions) ? runtimeState.rag.sessions : [];
  const hasAuth = Boolean(runtimeState.auth.user?.id);
  const activeId = String(runtimeState.rag.sessionId || "");
  const options = [];
  if (!hasAuth) {
    options.push(`<option value="">未登录（仅本地临时会话）</option>`);
  } else if (sessions.length === 0) {
    options.push(`<option value="">暂无会话（发送消息后自动创建）</option>`);
  } else {
    options.push(`<option value="">选择会话...</option>`);
    sessions.forEach((session) => {
      const sid = String(session?.id || "");
      const title = escapeHtml(String(session?.title || sid || "未命名会话"));
      options.push(`<option value="${escapeHtml(sid)}">${title}</option>`);
    });
  }
  select.innerHTML = options.join("");
  if (activeId) select.value = activeId;
  select.disabled = !hasAuth;
}

/**
 * 从后端拉取会话列表并刷新聊天会话下拉框。
 * @param {boolean} keepCurrent 是否优先保持当前选中会话。
 */
async function refreshChatSessions(keepCurrent = true) {
  if (!runtimeState.auth.user?.id) {
    runtimeState.rag.sessions = [];
    runtimeState.rag.sessionId = "";
    localStorage.removeItem("clawmind-rag-session-id");
    renderChatSessionOptions();
    return;
  }
  const result = await requestApi("/rag/sessions");
  const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
  runtimeState.rag.sessions = sessions.map((item) => ({
    id: String(item?.id || ""),
    title: String(item?.title || "未命名会话"),
    updatedAt: String(item?.updatedAt || ""),
  })).filter((item) => item.id);

  if (!keepCurrent || !runtimeState.rag.sessionId) {
    runtimeState.rag.sessionId = runtimeState.rag.sessions[0]?.id || "";
  } else {
    const exists = runtimeState.rag.sessions.some((item) => item.id === runtimeState.rag.sessionId);
    if (!exists) runtimeState.rag.sessionId = runtimeState.rag.sessions[0]?.id || "";
  }
  if (runtimeState.rag.sessionId) {
    localStorage.setItem("clawmind-rag-session-id", runtimeState.rag.sessionId);
  } else {
    localStorage.removeItem("clawmind-rag-session-id");
  }
  renderChatSessionOptions();
}

/**
 * 加载指定会话消息并回放到聊天面板。
 * @param {string} sessionId 会话 id。
 */
async function loadChatSessionMessages(sessionId) {
  const sid = String(sessionId || "").trim();
  if (!sid) {
    clearChatMessages(true);
    return;
  }
  const result = await requestApi(`/rag/sessions/${encodeURIComponent(sid)}/messages`);
  if (!result || !result.ok) {
    showAppAlert(String(result?.message || "会话消息加载失败，请稍后重试。"), "会话");
    return;
  }
  const controller = getOrCreateChatController();
  if (!controller || typeof controller.renderHistory !== "function") {
    clearChatMessages(true);
    return;
  }
  const messages = Array.isArray(result.messages) ? result.messages : [];
  controller.renderHistory(messages);
  if (messages.length === 0) {
    renderChatWelcomeMessage();
  }
}

/**
 * 切换聊天会话并回放历史消息。
 */
async function switchChatSession() {
  const select = document.getElementById("chat-session-select");
  if (!select) return;
  const nextId = String(select.value || "").trim();
  runtimeState.rag.sessionId = nextId;
  if (nextId) {
    localStorage.setItem("clawmind-rag-session-id", nextId);
  } else {
    localStorage.removeItem("clawmind-rag-session-id");
  }
  await loadChatSessionMessages(nextId);
}

/**
 * 新建聊天会话并立即切换到新会话。
 */
async function createNewChatSession() {
  if (!runtimeState.auth.user?.id) {
    showAppAlert("请先登录账号后再创建会话。", "会话");
    return;
  }
  const result = await requestApi("/rag/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: getRagUserId(),
      title: "新会话",
    }),
  });
  if (!result || !result.ok || !result.session?.id) {
    showAppAlert(String(result?.message || "新建会话失败。"), "会话");
    return;
  }
  runtimeState.rag.sessionId = String(result.session.id);
  localStorage.setItem("clawmind-rag-session-id", runtimeState.rag.sessionId);
  await refreshChatSessions(true);
  clearChatMessages(true);
}

/**
 * 删除当前选中的聊天会话。
 */
async function deleteCurrentChatSession() {
  if (!runtimeState.auth.user?.id) {
    showAppAlert("当前未登录，无可删除会话。", "会话");
    return;
  }
  const sessionId = String(runtimeState.rag.sessionId || "").trim();
  if (!sessionId) {
    showAppAlert("请先选择要删除的会话。", "会话");
    return;
  }
  const ok = await showAppConfirm("删除后该会话消息不可恢复，确认继续吗？", "删除会话");
  if (!ok) return;
  const result = await requestApi(`/rag/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  if (!result || !result.ok) {
    showAppAlert(String(result?.message || "删除会话失败。"), "会话");
    return;
  }
  runtimeState.rag.sessionId = "";
  localStorage.removeItem("clawmind-rag-session-id");
  await refreshChatSessions(false);
  if (runtimeState.rag.sessionId) {
    await loadChatSessionMessages(runtimeState.rag.sessionId);
  } else {
    clearChatMessages(true);
  }
}

/**
 * 优先调用后端会话型 RAG；不可用时返回 null 由前端本地 RAG 兜底。
 * @param {string} query 用户问题。
 * @param {any} context 当前上下文。
 * @returns {Promise<{answer:string,references:string[],source:"remote"|"local"}|null>} 回答结果。
 */
async function askBackendRag(query, context) {
  if (!runtimeState.auth.user?.id) return null;
  const sessionId = await getOrCreateRagSessionId();
  if (!sessionId) return null;
  const ragService = window.ClawMindRagService;
  const chunks = ragService?.buildChunks ? ragService.buildChunks(context) : [];
  const result = await requestApi("/rag/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: getRagUserId(),
      sessionId,
      query,
      fileName: String(context?.fileName || ""),
      chunks: chunks.map((item) => ({
        id: item.id,
        text: item.text,
        meta: item.meta,
      })),
    }),
  });
  if (!result || !result.ok || typeof result.answer !== "string") return null;
  if (typeof result.sessionId === "string" && result.sessionId) {
    runtimeState.rag.sessionId = result.sessionId;
    localStorage.setItem("clawmind-rag-session-id", runtimeState.rag.sessionId);
    if (runtimeState.auth.user?.id) {
      await refreshChatSessions(true);
    }
  }
  return {
    answer: result.answer,
    references: Array.isArray(result.references) ? result.references : [],
    source: "remote",
  };
}

/**
 * 调用用户配置的自定义模型接口（OpenAI 兼容协议）。
 * @param {string} query 用户问题。
 * @param {any} context 当前文档上下文。
 * @returns {Promise<{answer:string}|null>} 回答结果。
 */
async function askConfiguredModel(query, context) {
  const status = getModelConfigStatus();
  if (!status.enabled || !status.ready) {
    runtimeState.chat.lastModelError = status.reason;
    return null;
  }
  if (!runtimeState.auth.user?.id) {
    runtimeState.chat.lastModelError = "未登录账号";
    return null;
  }
  const endpoint = String(appState.llmEndpoint || "").trim();
  const apiKey = String(appState.llmApiKey || "").trim();
  const model = String(appState.llmModel || "").trim();
  const temperature = sanitizeFloat(appState.llmTemperature, 0.7, 0, 2);
  const topP = sanitizeFloat(appState.llmTopP, 1, 0, 1);
  const maxTokens = sanitizeCount(String(appState.llmMaxTokens || 1024), 1024, 8192);
  const streamEnabled = appState.llmStream !== false;
  const systemPrompt = String(appState.llmSystemPrompt || "").trim() || "你是一个专业的文档分析助手，擅长从文本中提取关键信息并给出清晰解读。";
  const sessionId = await getOrCreateRagSessionId();
  const fileName = String(context?.fileName || "").trim();
  const payload = {
    endpoint,
    apiKey,
    model,
    temperature,
    topP,
    maxTokens,
    stream: streamEnabled,
    systemPrompt,
    query,
    contextText: buildContextSummaryText(context),
    sessionId,
    title: fileName ? `${fileName} 会话` : "新会话",
  };
  const agentResult = await requestApi("/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (agentResult && agentResult.ok === true && typeof agentResult.answer === "string") {
    runtimeState.chat.lastModelError = "";
    if (typeof agentResult.sessionId === "string" && agentResult.sessionId) {
      runtimeState.rag.sessionId = agentResult.sessionId;
      localStorage.setItem("clawmind-rag-session-id", runtimeState.rag.sessionId);
      if (runtimeState.auth.user?.id) {
        await refreshChatSessions(true);
      }
    }
    return { answer: agentResult.answer, sourceTag: "LangGraph Agent" };
  }
  const agentError = String(agentResult?.message || "LangGraph 请求失败");
  const fallback = await requestApi("/model/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!fallback || fallback.ok !== true || typeof fallback.answer !== "string") {
    runtimeState.chat.lastModelError = `${agentError}；${String(fallback?.message || "模型代理请求失败")}`;
    return null;
  }
  runtimeState.chat.lastModelError = `LangGraph不可用，已回退模型代理：${agentError}`;
  return { answer: fallback.answer, sourceTag: "模型代理" };
}

/**
 * 使用配置好的模型进行流式对话。
 * @param {string} query 用户问题。
 * @param {any} context 当前文档上下文。
 * @param {(chunk:string)=>void} onChunk 收到片段回调。
 * @returns {Promise<void>}
 */
async function askConfiguredModelStream(query, context, onChunk) {
  const status = getModelConfigStatus();
  if (!status.enabled || !status.ready) {
    throw new Error(status.reason || "模型配置未就绪");
  }

  const sessionId = await getOrCreateRagSessionId();
  const contextText = buildContextSummaryText(context);
  const endpoint = String(appState.llmEndpoint || "").trim();
  const apiKey = String(appState.llmApiKey || "").trim();
  const model = String(appState.llmModel || "").trim();
  const temperature = sanitizeFloat(appState.llmTemperature, 0.7, 0, 2);
  const topP = sanitizeFloat(appState.llmTopP, 1, 0, 1);
  const maxTokens = sanitizeCount(String(appState.llmMaxTokens || 1024), 1024, 8192);
  const streamEnabled = appState.llmStream !== false;
  const systemPrompt = String(appState.llmSystemPrompt || "").trim() || "你是一个专业的文档分析助手，擅长从文本中提取关键信息并给出清晰解读。";
  const baseUrl = getApiBaseUrl();
  const token = runtimeState.auth.token;

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        query,
        sessionId,
        contextText,
        temperature,
        topP,
        maxTokens,
        stream: streamEnabled,
        systemPrompt,
        ...(endpoint ? { endpoint } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(model ? { model } : {})
      })
    });
  } catch (error) {
    throw new Error(`无法连接后端：${baseUrl}/chat/stream，请检查接口地址与端口`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`请求失败 (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // SSE 消息以 \n\n 分隔
    const parts = buffer.split("\n\n");
    // 保留最后一个可能不完整的部分
    buffer = parts.pop();

    for (const part of parts) {
      const lines = part.split("\n").filter(line => line.trim() !== "");
      let event = "message";
      let dataStr = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          event = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          dataStr = line.slice(6);
        }
      }

      if (!dataStr) continue;
      if (dataStr === "[DONE]") continue;

      try {
        const payload = JSON.parse(dataStr);
        if (event === "session") {
          if (payload.sessionId) {
            runtimeState.rag.sessionId = payload.sessionId;
            localStorage.setItem("clawmind-rag-session-id", payload.sessionId);
          }
        } else if (event === "error") {
          throw new Error(payload.message || "未知错误");
        } else if (payload.content) {
          onChunk(payload.content);
        }
      } catch (e) {
        if (event === "error") throw e;
        // 忽略解析错误
      }
    }
  }
}

/**
 * 构造传给模型的简化上下文，提升回答相关性。
 * @param {any} context 文档上下文对象。
 * @returns {string} 上下文摘要文本。
 */
function buildContextSummaryText(context) {
  const notes = Array.isArray(context?.notes) ? context.notes.slice(0, 8) : [];
  const pages = Array.isArray(context?.pages) ? context.pages.slice(0, 1) : [];
  const selectedText = String(context?.selectedText || "").trim();
  const pageText = pages
    .map((page) => htmlToPlainText(String(page?.html || "")))
    .filter(Boolean)
    .join("\n")
    .trim();
  const baseText = selectedText || pageText;
  const trimmedText = baseText.length > 5000 ? baseText.slice(0, 5000) : baseText;
  const noteText = notes
    .map((note) => String(note?.text || "").trim())
    .filter(Boolean)
    .join("\n");
  return [
    `文档：${String(context?.fileName || "未命名文档")}`,
    `当前页：${String(context?.currentPage || 1)}`,
    trimmedText ? `正文摘要：\n${trimmedText}` : "",
    noteText ? `学习笔记：\n${noteText}` : "",
  ].filter(Boolean).join("\n\n");
}

/**
 * 启动时尝试从后端拉取状态快照。
 */
async function hydrateStateFromBackend() {
  if (!runtimeState.auth.token) {
    runtimeState.backend.available = false;
    return;
  }
  const data = await requestApi("/state");
  if (!data || !data.ok || !data.state) {
    runtimeState.backend.available = false;
    return;
  }
  runtimeState.backend.available = true;
  const remote = data.state;
  const hasRemoteData = hasRemoteSyncState(remote);
  if (hasRemoteData) {
    applyRemoteSyncState(remote);
    return;
  }
  scheduleBackendSync();
}

/**
 * 判断后端状态快照是否包含可恢复的业务数据。
 * @param {any} remote 后端返回状态。
 * @returns {boolean} 是否包含有效业务内容。
 */
function hasRemoteSyncState(remote) {
  if (!remote || typeof remote !== "object") return false;
  const hasRemoteData = (
    Array.isArray(remote.libraryCategories) && remote.libraryCategories.length > 0
  ) || (
    Array.isArray(remote.questionBank) && remote.questionBank.length > 0
  ) || (
    Array.isArray(remote.learningRecords) && remote.learningRecords.length > 0
  ) || (
    Array.isArray(remote.libraryFiles) && remote.libraryFiles.length > 0
  ) || (
    Array.isArray(remote.todayTodos) && remote.todayTodos.length > 0
  ) || (
    Array.isArray(remote.scheduleTasks) && remote.scheduleTasks.length > 0
  ) || (
    Array.isArray(remote.yearGoals) && remote.yearGoals.length > 0
  ) || (
    Array.isArray(remote.quarterGoals) && remote.quarterGoals.length > 0
  ) || (
    Array.isArray(remote.goalKrs) && remote.goalKrs.length > 0
  ) || (
    Array.isArray(remote.goalTaskLinks) && remote.goalTaskLinks.length > 0
  ) || (
    Array.isArray(remote.krTaskLinks) && remote.krTaskLinks.length > 0
  ) || (
    Array.isArray(remote.quarterReviews) && remote.quarterReviews.length > 0
  ) || (
    remote.workspaceData && typeof remote.workspaceData === "object" && Object.keys(remote.workspaceData).length > 0
  );
  return hasRemoteData;
}

/**
 * 应用后端返回的状态快照。
 * @param {any} remote 后端状态对象。
 */
function applyRemoteSyncState(remote) {
  if (!remote || typeof remote !== "object") return;
  if (typeof remote.themeMode === "string") appState.themeMode = remote.themeMode;
  if (typeof remote.themeColor === "string") appState.themeColor = remote.themeColor;
  if (typeof remote.autoSyncQuestionBank === "boolean") appState.autoSyncQuestionBank = remote.autoSyncQuestionBank;
  if (typeof remote.autoSyncMaxPerSave === "number") appState.autoSyncMaxPerSave = sanitizeCount(String(remote.autoSyncMaxPerSave), 5, 20);
  if (typeof remote.librarySortBy === "string") appState.librarySortBy = remote.librarySortBy;
  if (typeof remote.libraryStatusFilter === "string") appState.libraryStatusFilter = remote.libraryStatusFilter;
  if (typeof remote.libraryPageSize === "number") appState.libraryPageSize = sanitizeCount(String(remote.libraryPageSize), 12, 24);
  if (typeof remote.questionSourceFilter === "string") appState.questionSourceFilter = remote.questionSourceFilter;
  if (typeof remote.llmEnabled === "boolean") appState.llmEnabled = remote.llmEnabled;
  if (typeof remote.llmEndpoint === "string") appState.llmEndpoint = remote.llmEndpoint;
  if (typeof remote.llmModel === "string") appState.llmModel = remote.llmModel;
  if (typeof remote.llmApiKey === "string") appState.llmApiKey = remote.llmApiKey;
  if (typeof remote.llmTemperature === "number") appState.llmTemperature = sanitizeFloat(remote.llmTemperature, 0.7, 0, 2);
  if (typeof remote.llmTopP === "number") appState.llmTopP = sanitizeFloat(remote.llmTopP, 1, 0, 1);
  if (typeof remote.llmMaxTokens === "number") appState.llmMaxTokens = sanitizeCount(String(remote.llmMaxTokens), 1024, 8192);
  if (typeof remote.llmStream === "boolean") appState.llmStream = remote.llmStream;
  if (typeof remote.llmSystemPrompt === "string") appState.llmSystemPrompt = remote.llmSystemPrompt;
  if (typeof remote.workspaceViewMode === "string" && remote.workspaceViewMode === "original") {
    appState.workspaceViewMode = "original";
  }
  if (typeof remote.workspacePdfZoom === "number") {
    appState.workspacePdfZoom = Math.max(40, Math.min(260, remote.workspacePdfZoom));
  }
  if (typeof remote.workspaceBrushMode === "string" && (remote.workspaceBrushMode === "free" || remote.workspaceBrushMode === "rect")) {
    appState.workspaceBrushMode = remote.workspaceBrushMode;
  }
  if (typeof remote.workspaceBrushColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(remote.workspaceBrushColor)) {
    appState.workspaceBrushColor = remote.workspaceBrushColor;
  }
  if (typeof remote.highlightColor === "string" && HIGHLIGHT_COLORS[remote.highlightColor]) {
    appState.highlightColor = remote.highlightColor;
  }
  if (typeof remote.highlightStyle === "string" && HIGHLIGHT_STYLES[remote.highlightStyle]) {
    appState.highlightStyle = remote.highlightStyle;
  }
  if (remote.onboarding && typeof remote.onboarding === "object") {
    appState.onboarding.isNewUser = Boolean(remote.onboarding.isNewUser);
    appState.onboarding.globalDone = Boolean(remote.onboarding.globalDone);
    appState.onboarding.pageSeen = (remote.onboarding.pageSeen && typeof remote.onboarding.pageSeen === "object")
      ? remote.onboarding.pageSeen
      : {};
  }
  if (typeof remote.selectedCategoryId === "string") appState.selectedCategoryId = remote.selectedCategoryId;
  if (typeof remote.selectedCalendarDate === "string") appState.selectedCalendarDate = remote.selectedCalendarDate;
  if (typeof remote.activeFileId === "string") appState.activeFileId = remote.activeFileId;
  if (typeof remote.notesPageSize === "number") appState.notesPageSize = sanitizeCount(String(remote.notesPageSize), 10, 16);
  if (typeof remote.notesSort === "string") appState.notesSort = remote.notesSort === "oldest" ? "oldest" : "newest";
  if (Array.isArray(remote.yearGoals)) appState.yearGoals = remote.yearGoals;
  if (Array.isArray(remote.quarterGoals)) appState.quarterGoals = remote.quarterGoals;
  if (Array.isArray(remote.goalKrs)) appState.goalKrs = remote.goalKrs;
  if (Array.isArray(remote.goalTaskLinks)) appState.goalTaskLinks = remote.goalTaskLinks;
  if (Array.isArray(remote.krTaskLinks)) appState.krTaskLinks = remote.krTaskLinks;
  if (Array.isArray(remote.quarterReviews)) appState.quarterReviews = remote.quarterReviews;
  if (typeof remote.selectedGoalPeriod === "string") appState.selectedGoalPeriod = remote.selectedGoalPeriod;
  if (typeof remote.selectedQuarterGoalId === "string") appState.selectedQuarterGoalId = remote.selectedQuarterGoalId;
  if (typeof remote.goalTaskSort === "string") appState.goalTaskSort = remote.goalTaskSort;
  if (Array.isArray(remote.collapsedCategoryIds)) appState.collapsedCategoryIds = remote.collapsedCategoryIds;
  if (Array.isArray(remote.libraryCategories)) appState.libraryCategories = remote.libraryCategories;
  if (Array.isArray(remote.libraryFiles)) appState.libraryFiles = remote.libraryFiles;
  if (remote.workspaceData && typeof remote.workspaceData === "object") appState.workspaceData = remote.workspaceData;
  if (Array.isArray(remote.todayTodos)) appState.todayTodos = remote.todayTodos;
  if (Array.isArray(remote.scheduleTasks)) appState.scheduleTasks = remote.scheduleTasks;
  if (Array.isArray(remote.learningRecords)) appState.learningRecords = remote.learningRecords;
  if (Array.isArray(remote.questionBank)) appState.questionBank = remote.questionBank;
  if (Array.isArray(remote.questionCategories)) appState.questionCategories = remote.questionCategories;
  normalizeQuestionBankItems();
  normalizeQuestionCategories();
}

/**
 * 延迟触发一次状态同步，减少高频写入。
 */
function scheduleBackendSync() {
  if (!runtimeState.auth.token) return;
  if (!runtimeState.backend.available) {
    void probeBackendAvailability();
    return;
  }
  if (runtimeState.backend.syncTimer) {
    clearTimeout(runtimeState.backend.syncTimer);
  }
  runtimeState.backend.syncTimer = setTimeout(() => {
    runtimeState.backend.syncTimer = null;
    void syncStateToBackend();
  }, 800);
}

/**
 * 探测后端是否可用，便于在服务后启动后自动恢复同步。
 */
async function probeBackendAvailability() {
  if (!runtimeState.auth.token) return;
  if (runtimeState.backend.probing) return;
  runtimeState.backend.probing = true;
  const result = await requestApi("/health");
  runtimeState.backend.available = Boolean(result && result.ok);
  runtimeState.backend.probing = false;
  if (runtimeState.backend.available) {
    scheduleBackendSync();
  }
}

/**
 * 将核心状态写入后端 SQLite。
 */
async function syncStateToBackend() {
  if (!runtimeState.auth.token) return;
  if (!runtimeState.backend.available || runtimeState.backend.syncing) return;
  runtimeState.backend.syncing = true;
  const payload = buildPersistableState();
  const result = await requestApi("/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  runtimeState.backend.syncing = false;
  if (!result || result.ok !== true) {
    runtimeState.backend.available = false;
  }
}

/**
 * 标准化题库历史数据结构，补齐来源和创建时间字段。
 */
function normalizeQuestionBankItems() {
  if (!Array.isArray(appState.questionBank)) {
    appState.questionBank = [];
    return;
  }
  appState.questionBank = appState.questionBank.map((item, index) => ({
    id: item?.id || Date.now() + index,
    category: String(item?.category || "未分类").trim(),
    content: String(item?.content || "").trim(),
    answer: String(item?.answer || "").trim(),
    source: String(item?.source || "manual").trim(),
    createdAt: item?.createdAt || new Date().toISOString(),
  })).filter((item) => item.content && item.answer);
}

/**
 * 标准化题库分类数组，去重并移除空值。
 */
function normalizeQuestionCategories() {
  const merged = new Set();
  (appState.questionCategories || []).forEach((item) => {
    const name = String(item || "").trim();
    if (name) merged.add(name);
  });
  appState.questionBank.forEach((item) => {
    const name = String(item?.category || "").trim();
    if (name) merged.add(name);
  });
  if (merged.size === 0) merged.add("英语每日新词");
  appState.questionCategories = Array.from(merged);
}

/**
 * 支持将多个文件直接拖到页面进行上传（图书馆页面生效）。
 */
function bindGlobalFileDrop() {
  window.addEventListener("dragover", (event) => {
    const hasFiles = Array.from(event.dataTransfer?.types || []).includes("Files");
    if (!hasFiles) return;
    event.preventDefault();
  });
  window.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    if (appState.currentPage !== "library") return;
    event.preventDefault();
    void uploadFiles(Array.from(files));
  });
}

/**
 * 修复历史数据中的无效分类引用，避免路径映射丢失。
 */
function normalizeLibraryFilesCategory() {
  const validCategoryIds = new Set(appState.libraryCategories.map((cat) => cat.id));
  const fallbackCategory = appState.libraryCategories[0]?.id || "";
  appState.libraryFiles.forEach((file) => {
    if (!validCategoryIds.has(file.categoryId)) {
      file.categoryId = fallbackCategory;
    }
    if (typeof file.lastOpenedAt !== "string") file.lastOpenedAt = "";
    if (typeof file.completed !== "boolean") file.completed = false;
    if (typeof file.completedAt !== "string") file.completedAt = "";
  });
}

/**
 * 标准化工作区数据结构，兼容旧版本 contentHtml 字段。
 */
function normalizeWorkspaceData() {
  Object.keys(appState.workspaceData).forEach((fileId) => {
    const data = appState.workspaceData[fileId];
    if (!data) return;
    if (!Array.isArray(data.pages)) {
      const oldHtml = typeof data.contentHtml === "string" ? data.contentHtml : "<p>暂无内容</p>";
      data.pages = [
        {
          html: oldHtml,
          highlights: [],
          marginNotes: [],
        },
      ];
      delete data.contentHtml;
    }
    data.pages = data.pages.map((page) => ({
      html: typeof page.html === "string" ? page.html : "<p>暂无内容</p>",
      highlights: Array.isArray(page.highlights)
        ? page.highlights.map((item) => ({
          ...item,
          color: HIGHLIGHT_COLORS[item?.color] ? item.color : "yellow",
          style: HIGHLIGHT_STYLES[item?.style] ? item.style : "fill",
          spanTokens: Array.isArray(item?.spanTokens) ? item.spanTokens : [],
          spanSegments: Array.isArray(item?.spanSegments) ? item.spanSegments : [],
          meaning: typeof item?.meaning === "string" ? item.meaning : "",
        }))
        : [],
      marginNotes: Array.isArray(page.marginNotes) ? page.marginNotes : [],
    }));
    if (!Array.isArray(data.notes)) data.notes = [];
    if (!Array.isArray(data.vocab)) data.vocab = [];
    if (!data.pageDrawings || typeof data.pageDrawings !== "object") data.pageDrawings = {};
    if (!data.pageTexts || typeof data.pageTexts !== "object") data.pageTexts = {};
    if (!data.savedAt) data.savedAt = null;
    if (!data.syncState || typeof data.syncState !== "object") {
      data.syncState = {
        lastNoteCount: 0,
        lastHighlightCount: 0,
      };
    }
  });
}

/**
 * 绑定侧边栏导航点击事件。
 */
function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const page = item.dataset.page;
      if (!page) return;
      navigateTo(page);
    });
  });
}

/**
 * 切换页面并同步导航高亮。
 * @param {string} pageName 页面标识。
 */
function navigateTo(pageName) {
  appState.currentPage = pageName;
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));

  const targetPage = document.getElementById(`page-${pageName}`);
  const targetNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (targetPage) targetPage.classList.add("active");
  if (targetNav) targetNav.classList.add("active");
  if (pageName === "goals") {
    renderGoalCenter();
  }
  if (pageName === "dashboard") {
    maybeShowDailyFeedbackBanner();
  }
  maybeStartOnboardingForPage(pageName);
}

/**
 * 绑定工作区 Tab 切换。
 */
function bindTabSwitch() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab || "notes";
      appState.currentTab = target;
      tabs.forEach((btn) => btn.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.classList.add("active");
      if (target === "vocab") renderWorkspaceVocab();
      if (target === "chat") renderChatWelcomeMessage();
    });
  });
}

/**
 * 新用户引导配置（全局 + 各页面首访说明）。
 */
const PAGE_ONBOARDING_CONFIG = {
  dashboard: {
    title: "首页功能简介",
    text: "这里汇总今日任务、学习热力与目标进度。\n第一步建议去「图书馆」导入第一份学习资料，然后回到「工作区」开始学习。",
    selector: "#page-dashboard .stats-grid",
  },
  library: {
    title: "图书馆功能简介",
    text: "图书馆用于上传资料、维护分类、管理学习状态。\n建议先创建分类，再上传 PDF/MD/DOCX/TXT。",
    selector: "#page-library .library-layout",
  },
  workspace: {
    title: "工作区功能简介",
    text: "这里是文档精读区：支持原版 PDF 阅读、选中高亮、做笔记和一键提炼。",
    selector: "#page-workspace .workspace-layout",
  },
  scheduler: {
    title: "日程中心功能简介",
    text: "这里负责学习节奏管理：\n1) 点日期查看任务与进度\n2) 双击日期快速新建任务\n3) 任务支持每天/每周/工作日循环\n4) 下方复习时间线会自动联动学习记录。",
    selector: "#page-scheduler .schedule-grid",
  },
  goals: {
    title: "目标中心功能简介",
    text: "目标中心建议按这条路径使用：\n1) 先建年度目标（方向与终局结果）\n2) 再建季度目标（阶段里程碑）\n3) 在 KR 中绑定任务，系统会根据任务完成率自动计算 KR 与季度进度条\n4) KR 任务与日程中心任务联动，日程完成会推动目标进度。",
    selector: "#page-goals .goals-layout",
  },
  "question-bank": {
    title: "随机题库功能简介",
    text: "这里做复习闭环：\n1) 可按分类/来源随机抽题\n2) 支持批量导入知识点\n3) 工作区高亮/笔记可自动沉淀到题库。",
    selector: "#page-question-bank .random-bank-section",
  },
  settings: {
    title: "设置功能简介",
    text: "可配置外观、模型参数与数据管理。\n建议在这里完成首次偏好设置。",
    selector: "#page-settings .settings-grid",
  },
};

function getGlobalOnboardingSteps() {
  return [
    {
      title: "欢迎来到 ClawMind",
      text: "这是新用户引导。\n我会先带你快速认识各个核心栏目。",
      selector: ".sidebar",
    },
    {
      title: "图书馆",
      text: "用于管理学习资料和分类结构，是所有学习流程的起点。",
      selector: '.nav-item[data-page=\"library\"]',
    },
    {
      title: "工作区",
      text: "文档精读区域，可做高亮、笔记、词汇沉淀，并联动 AI 助手。",
      selector: '.nav-item[data-page=\"workspace\"]',
    },
    {
      title: "日程中心",
      text: "规划每日任务和周期任务，形成稳定学习节奏。",
      selector: '.nav-item[data-page=\"scheduler\"]',
    },
    {
      title: "目标中心",
      text: "拆分年度目标与季度 OKR，让计划有明确完成路径。",
      selector: '.nav-item[data-page=\"goals\"]',
    },
    {
      title: "随机题库与设置",
      text: "题库用于复习闭环；设置中可管理主题、模型与数据。",
      selector: '.nav-item[data-page=\"question-bank\"]',
    },
  ];
}

function shouldStartNewUserOnboarding() {
  return Boolean(appState.onboarding?.isNewUser);
}

function maybeStartOnboardingForPage(pageName) {
  if (!shouldStartNewUserOnboarding()) return;
  if (runtimeState.onboarding.active) return;
  if (hasBlockingModalOpen()) return;
  if (!appState.onboarding.globalDone) return;
  if (appState.onboarding.pageSeen && appState.onboarding.pageSeen[pageName]) return;
  const config = PAGE_ONBOARDING_CONFIG[pageName];
  if (!config) return;
  startOnboarding(
    [{ title: config.title, text: config.text, selector: config.selector }],
    () => {
      if (!appState.onboarding.pageSeen || typeof appState.onboarding.pageSeen !== "object") {
        appState.onboarding.pageSeen = {};
      }
      appState.onboarding.pageSeen[pageName] = true;
      persistLocalState();
    },
  );
}

function maybeStartGlobalOnboarding() {
  if (!shouldStartNewUserOnboarding()) return;
  if (runtimeState.onboarding.active) return;
  if (hasBlockingModalOpen()) {
    setTimeout(() => {
      maybeStartGlobalOnboarding();
    }, 180);
    return;
  }
  if (appState.onboarding.globalDone) return;
  startOnboarding(getGlobalOnboardingSteps(), () => {
    appState.onboarding.globalDone = true;
    persistLocalState();
    maybeStartOnboardingForPage(appState.currentPage);
  });
}

function startOnboarding(steps, onFinish) {
  if (!Array.isArray(steps) || steps.length === 0) return;
  if (hasBlockingModalOpen()) return;
  runtimeState.onboarding.active = true;
  runtimeState.onboarding.steps = steps;
  runtimeState.onboarding.index = 0;
  runtimeState.onboarding.onFinish = typeof onFinish === "function" ? onFinish : null;
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const overlay = document.getElementById("onboarding-overlay");
  const title = document.getElementById("onboarding-title");
  const text = document.getElementById("onboarding-text");
  const stepLabel = document.getElementById("onboarding-step");
  const prevBtn = document.getElementById("onboarding-prev-btn");
  const nextBtn = document.getElementById("onboarding-next-btn");
  const highlight = document.getElementById("onboarding-highlight");
  if (!overlay || !title || !text || !stepLabel || !prevBtn || !nextBtn || !highlight) return;
  const steps = runtimeState.onboarding.steps || [];
  const index = Math.min(Math.max(0, runtimeState.onboarding.index || 0), Math.max(0, steps.length - 1));
  const step = steps[index];
  if (!step) return;
  overlay.classList.add("show");
  title.textContent = String(step.title || "新手引导");
  text.textContent = String(step.text || "");
  stepLabel.textContent = `步骤 ${index + 1} / ${steps.length}`;
  prevBtn.disabled = index === 0;
  nextBtn.textContent = index >= steps.length - 1 ? "完成" : "下一步";
  const rect = resolveOnboardingTargetRect(step.selector);
  if (rect) {
    highlight.style.left = `${Math.max(8, rect.left - 8)}px`;
    highlight.style.top = `${Math.max(8, rect.top - 8)}px`;
    highlight.style.width = `${Math.max(60, rect.width + 16)}px`;
    highlight.style.height = `${Math.max(36, rect.height + 16)}px`;
    highlight.classList.add("show");
  } else {
    highlight.classList.remove("show");
  }
}

function resolveOnboardingTargetRect(selector) {
  if (!selector) return null;
  const target = document.querySelector(selector);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

function hasBlockingModalOpen() {
  return document.querySelectorAll(".modal.show").length > 0;
}

function finishOnboarding(complete = true) {
  const overlay = document.getElementById("onboarding-overlay");
  const highlight = document.getElementById("onboarding-highlight");
  if (overlay) overlay.classList.remove("show");
  if (highlight) highlight.classList.remove("show");
  const onFinish = runtimeState.onboarding.onFinish;
  runtimeState.onboarding.active = false;
  runtimeState.onboarding.steps = [];
  runtimeState.onboarding.index = 0;
  runtimeState.onboarding.onFinish = null;
  if (complete && typeof onFinish === "function") onFinish();
}

function onboardingPrev() {
  if (!runtimeState.onboarding.active) return;
  runtimeState.onboarding.index = Math.max(0, runtimeState.onboarding.index - 1);
  renderOnboardingStep();
}

function onboardingNext() {
  if (!runtimeState.onboarding.active) return;
  const steps = runtimeState.onboarding.steps || [];
  if (runtimeState.onboarding.index >= steps.length - 1) {
    finishOnboarding(true);
    return;
  }
  runtimeState.onboarding.index += 1;
  renderOnboardingStep();
}

function onboardingSkip() {
  if (!runtimeState.onboarding.active) return;
  finishOnboarding(false);
  appState.onboarding.globalDone = true;
  if (!appState.onboarding.pageSeen || typeof appState.onboarding.pageSeen !== "object") {
    appState.onboarding.pageSeen = {};
  }
  Object.keys(PAGE_ONBOARDING_CONFIG).forEach((name) => {
    appState.onboarding.pageSeen[name] = true;
  });
  persistLocalState();
}

/**
 * 绑定图书馆分类树点击事件（含折叠按钮、分类选择、拖拽放置）。
 */
function bindCategoryTreeClick() {
  const tree = document.getElementById("category-tree");
  if (!tree) return;

  tree.addEventListener("click", (event) => {
    const toggle = event.target.closest(".tree-toggle");
    if (toggle) {
      const categoryId = toggle.dataset.categoryId;
      if (categoryId) toggleCategoryCollapsed(categoryId);
      return;
    }

    const item = event.target.closest(".category-item");
    if (!item) return;
    const categoryId = item.dataset.categoryId;
    if (!categoryId) return;
    appState.selectedCategoryId = categoryId;
    appState.libraryPage = 1;
    renderLibraryCategoryTree();
    renderLibraryFiles();
    populateUploadCategoryOptions();
  });

  tree.addEventListener("dragover", (event) => {
    const target = event.target.closest(".category-item");
    if (!target) return;
    event.preventDefault();
    target.classList.add("drag-over");
  });

  tree.addEventListener("dragleave", (event) => {
    const target = event.target.closest(".category-item");
    if (!target) return;
    target.classList.remove("drag-over");
  });

  tree.addEventListener("drop", (event) => {
    const target = event.target.closest(".category-item");
    if (!target) return;
    event.preventDefault();
    target.classList.remove("drag-over");
    const fileId = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
    const categoryId = target.dataset.categoryId || "";
    if (!fileId || !categoryId) return;
    moveFileToCategory(fileId, categoryId);
  });
}

/**
 * 绑定工作区文件选择器（路径 → 文件两步 + 关键字检索），切换当前学习文档。
 */
function bindWorkspaceFileSelect() {
  const categorySelect = document.getElementById("workspace-category-select");
  const fileSelect = document.getElementById("workspace-file-select");
  const searchInput = document.getElementById("workspace-file-search");

  if (categorySelect) {
    categorySelect.addEventListener("change", () => populateWorkspaceFileList());
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => populateWorkspaceFileList());
  }
  if (fileSelect) {
    fileSelect.addEventListener("change", async () => {
      const fileId = fileSelect.value;
      if (!fileId) return;
      await openDocument(fileId);
    });
  }
}

/**
 * 绑定上传区域点击事件。
 */
function bindUploadArea() {
  const uploadArea = document.getElementById("upload-area");
  const fileInput = document.getElementById("file-input");
  if (!uploadArea || !fileInput) return;
  uploadArea.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      void uploadFile();
    }
  });
  uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadArea.classList.add("drag-over");
  });
  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
  });
  uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadArea.classList.remove("drag-over");
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    void uploadFiles(Array.from(files));
  });
}

/**
 * 绑定聊天输入回车发送事件。
 */
function bindEnterToSend() {
  const input = document.getElementById("chat-input");
  if (!input) return;
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    sendChat();
  });
}

function toggleDocAssistant(force) {
  const panel = document.getElementById("assistant-panel");
  if (!panel) return;
  const toggle = document.getElementById("assistant-toggle");
  const shouldOpen = typeof force === "boolean" ? force : !panel.classList.contains("open");
  panel.classList.toggle("open", shouldOpen);
  if (toggle) toggle.classList.toggle("hidden", shouldOpen);
  if (shouldOpen) {
    renderChatWelcomeMessage();
  }
}

/**
 * 绑定主题色选择交互并持久化外观设置。
 */
function bindThemeColorPicker() {
  if (window.ClawMindAppearance?.bindThemeColorPicker) {
    window.ClawMindAppearance.bindThemeColorPicker(
      appState,
      (key, value) => {
        appState[key] = value;
      },
      persistLocalState,
    );
    return;
  }
  const options = document.querySelectorAll(".color-option");
  if (options.length === 0) return;
  options.forEach((option) => {
    option.addEventListener("click", () => {
      const color = option.dataset.color || "";
      if (!color) return;
      appState.themeColor = color;
      applyThemeColor(color);
      options.forEach((node) => node.classList.remove("active"));
      option.classList.add("active");
      persistLocalState();
    });
  });
  syncThemeOptionActive();
}

/**
 * 绑定暗色/白天模式切换。
 */
function bindAppearanceModeToggle() {
  if (window.ClawMindAppearance?.bindAppearanceModeToggle) {
    window.ClawMindAppearance.bindAppearanceModeToggle(
      appState,
      (key, value) => {
        appState[key] = value;
      },
      persistLocalState,
    );
    return;
  }
  const toggle = document.getElementById("appearance-mode-toggle");
  if (!toggle) return;
  toggle.checked = appState.themeMode === "dark";
  toggle.addEventListener("change", () => {
    appState.themeMode = toggle.checked ? "dark" : "light";
    applyThemeMode(appState.themeMode);
    persistLocalState();
  });
}

/**
 * 应用外观模式到页面根节点。
 * @param {"dark"|"light"} mode 外观模式。
 */
function applyThemeMode(mode) {
  if (window.ClawMindAppearance?.applyThemeMode) {
    window.ClawMindAppearance.applyThemeMode(mode);
    return;
  }
  document.body.dataset.theme = mode;
}

/**
 * 绑定图书馆排序与状态筛选控件。
 */
function bindLibraryFilterControls() {
  const sort = document.getElementById("library-sort-select");
  const filter = document.getElementById("library-status-filter");
  const pageSize = document.getElementById("library-page-size");
  if (!sort || !filter) return;
  sort.value = appState.librarySortBy;
  filter.value = appState.libraryStatusFilter;
  if (pageSize) pageSize.value = String(appState.libraryPageSize || 12);
  sort.addEventListener("change", () => {
    appState.librarySortBy = sort.value;
    appState.libraryPage = 1;
    renderLibraryFiles();
    persistLocalState();
  });
  filter.addEventListener("change", () => {
    appState.libraryStatusFilter = filter.value;
    appState.libraryPage = 1;
    renderLibraryFiles();
    persistLocalState();
  });
  if (pageSize) {
    pageSize.addEventListener("change", () => {
      appState.libraryPageSize = sanitizeCount(pageSize.value, 12, 24);
      pageSize.value = String(appState.libraryPageSize);
      appState.libraryPage = 1;
      renderLibraryFiles();
      persistLocalState();
    });
  }
}

/**
 * 绑定题库页分类与来源筛选控件。
 */
function bindQuestionBankFilterControls() {
  const category = document.getElementById("question-category-select");
  const source = document.getElementById("question-source-filter");
  if (!category || !source) return;
  category.addEventListener("change", () => {
    renderQuestionBankSummary();
  });
  source.value = appState.questionSourceFilter || "all";
  source.addEventListener("change", () => {
    appState.questionSourceFilter = source.value || "all";
    renderQuestionBankSummary();
    persistLocalState();
  });
}

/**
 * 绑定“学习痕迹自动同步题库”设置项。
 */
function bindAutoSyncSettings() {
  const toggle = document.getElementById("auto-sync-question-toggle");
  const maxInput = document.getElementById("auto-sync-max-count");
  if (toggle) {
    toggle.checked = appState.autoSyncQuestionBank !== false;
    toggle.addEventListener("change", () => {
      appState.autoSyncQuestionBank = toggle.checked;
      persistLocalState();
    });
  }
  if (maxInput) {
    maxInput.value = String(appState.autoSyncMaxPerSave || 5);
    maxInput.addEventListener("change", () => {
      appState.autoSyncMaxPerSave = sanitizeCount(maxInput.value, 5, 20);
      maxInput.value = String(appState.autoSyncMaxPerSave);
      persistLocalState();
    });
  }
}

/**
 * 绑定自定义模型配置设置项。
 */
function bindModelSettings() {
  const enabled = document.getElementById("llm-enabled-toggle");
  const endpoint = document.getElementById("llm-endpoint-input");
  const model = document.getElementById("llm-model-input");
  const apiKey = document.getElementById("llm-api-key-input");
  const temperature = document.getElementById("llm-temperature-input");
  const topP = document.getElementById("llm-top-p-input");
  const maxTokens = document.getElementById("llm-max-tokens-input");
  const streamToggle = document.getElementById("llm-stream-toggle");
  const systemPrompt = document.getElementById("llm-system-prompt-input");
  if (!enabled || !endpoint || !model || !apiKey || !temperature || !topP || !maxTokens || !streamToggle || !systemPrompt) return;
  enabled.checked = appState.llmEnabled === true;
  endpoint.value = appState.llmEndpoint || "";
  model.value = appState.llmModel || "";
  apiKey.value = appState.llmApiKey || "";
  temperature.value = String(appState.llmTemperature ?? 0.7);
  topP.value = String(appState.llmTopP ?? 1);
  maxTokens.value = String(appState.llmMaxTokens ?? 1024);
  streamToggle.checked = appState.llmStream !== false;
  systemPrompt.value = appState.llmSystemPrompt || "";
  enabled.addEventListener("change", () => {
    appState.llmEnabled = enabled.checked;
    persistLocalState();
    syncChatModeTip();
  });
  /**
   * 自动保存输入框配置，避免漏点“保存”按钮导致模型未生效。
   */
  const autoSave = () => {
    appState.llmEndpoint = endpoint.value.trim();
    appState.llmModel = model.value.trim();
    appState.llmApiKey = apiKey.value.trim();
    appState.llmTemperature = sanitizeFloat(temperature.value, 0.7, 0, 2);
    appState.llmTopP = sanitizeFloat(topP.value, 1, 0, 1);
    appState.llmMaxTokens = sanitizeCount(maxTokens.value, 1024, 8192);
    appState.llmStream = streamToggle.checked;
    appState.llmSystemPrompt = systemPrompt.value.trim();
    if (appState.llmEndpoint && appState.llmModel && appState.llmApiKey && !appState.llmEnabled) {
      appState.llmEnabled = true;
      enabled.checked = true;
    }
    persistLocalState();
    syncChatModeTip();
  };
  endpoint.addEventListener("change", autoSave);
  model.addEventListener("change", autoSave);
  apiKey.addEventListener("change", autoSave);
  temperature.addEventListener("change", autoSave);
  topP.addEventListener("change", autoSave);
  maxTokens.addEventListener("change", autoSave);
  streamToggle.addEventListener("change", autoSave);
  systemPrompt.addEventListener("change", autoSave);
}

/**
 * 计算当前模型配置状态。
 * @returns {{enabled:boolean,ready:boolean,reason:string}} 配置状态。
 */
function getModelConfigStatus() {
  if (appState.llmEnabled !== true) {
    return { enabled: false, ready: false, reason: "未启用智能模型" };
  }
  if (!String(appState.llmEndpoint || "").trim()) {
    return { enabled: true, ready: false, reason: "未填写模型接口地址" };
  }
  if (!String(appState.llmModel || "").trim()) {
    return { enabled: true, ready: false, reason: "未填写模型名称" };
  }
  if (!String(appState.llmApiKey || "").trim()) {
    return { enabled: true, ready: false, reason: "未填写API Key" };
  }
  return { enabled: true, ready: true, reason: "" };
}

/**
 * 保存模型配置并更新聊天模式提示。
 */
function saveModelSettings() {
  const enabled = document.getElementById("llm-enabled-toggle");
  appState.llmEnabled = Boolean(enabled?.checked);
  appState.llmEndpoint = getValue("llm-endpoint-input");
  appState.llmModel = getValue("llm-model-input");
  appState.llmApiKey = getValue("llm-api-key-input");
  appState.llmTemperature = sanitizeFloat(getValue("llm-temperature-input"), 0.7, 0, 2);
  appState.llmTopP = sanitizeFloat(getValue("llm-top-p-input"), 1, 0, 1);
  appState.llmMaxTokens = sanitizeCount(getValue("llm-max-tokens-input"), 1024, 8192);
  appState.llmStream = Boolean(document.getElementById("llm-stream-toggle")?.checked);
  appState.llmSystemPrompt = getValue("llm-system-prompt-input").trim();
  persistLocalState();
  syncChatModeTip();
  showAppAlert("模型配置已保存。");
}

/**
 * 应用主题色到 CSS 变量，更新主色和半透明主色。
 * @param {string} colorHex 主题色十六进制值。
 */
function applyThemeColor(colorHex) {
  if (window.ClawMindAppearance?.applyThemeColor) {
    window.ClawMindAppearance.applyThemeColor(colorHex);
    return;
  }
  const root = document.documentElement;
  root.style.setProperty("--primary", colorHex);
  root.style.setProperty("--primary-soft", hexToRgba(colorHex, 0.15));
}

/**
 * 同步主题色选中态到设置页面色块。
 */
function syncThemeOptionActive() {
  if (window.ClawMindAppearance?.syncThemeOptionActive) {
    window.ClawMindAppearance.syncThemeOptionActive(appState.themeColor);
    return;
  }
  const options = document.querySelectorAll(".color-option");
  options.forEach((option) => {
    const active = (option.dataset.color || "").toLowerCase() === appState.themeColor.toLowerCase();
    option.classList.toggle("active", active);
  });
}

/**
 * 将十六进制颜色转换为 RGBA 字符串。
 * @param {string} hex 十六进制颜色。
 * @param {number} alpha 透明度。
 * @returns {string} RGBA 颜色字符串。
 */
function hexToRgba(hex, alpha) {
  if (window.ClawMindAppearance?.hexToRgba) {
    return window.ClawMindAppearance.hexToRgba(hex, alpha);
  }
  const pure = hex.replace("#", "");
  if (pure.length !== 6) return "rgba(233,69,96,0.15)";
  const r = Number.parseInt(pure.slice(0, 2), 16);
  const g = Number.parseInt(pure.slice(2, 4), 16);
  const b = Number.parseInt(pure.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 渲染每日励志语。
 */
function renderDailyQuote() {
  const quoteEl = document.getElementById("daily-quote");
  if (!quoteEl) return;
  const daySeed = Math.floor(Date.now() / (24 * 3600 * 1000));
  quoteEl.textContent = `“${appState.dailyQuotes[daySeed % appState.dailyQuotes.length]}”`;
}

/**
 * 随机刷新励志语。
 */
function refreshDailyQuote() {
  const quoteEl = document.getElementById("daily-quote");
  if (!quoteEl) return;
  const idx = Math.floor(Math.random() * appState.dailyQuotes.length);
  quoteEl.textContent = `“${appState.dailyQuotes[idx]}”`;
}

/**
 * 渲染首页热力图。
 */
function renderHeatmap() {
  const heatmap = document.getElementById("heatmap");
  if (!heatmap) return;
  heatmap.innerHTML = "";
  for (let i = 0; i < 28; i += 1) {
    const cell = document.createElement("div");
    cell.className = `heat-cell lv-${Math.floor(Math.random() * 4)}`;
    heatmap.appendChild(cell);
  }
}

function getScheduleTasksForDate(dateStr) {
  return appState.scheduleTasks.filter((task) => doesTaskOccurOnDate(task, dateStr));
}

function doesTaskOccurOnDate(task, dateStr) {
  if (!task || !dateStr) return false;
  if (getTaskDateOnly(task) === dateStr) return true;
  const frequency = String(task.frequency || "").trim();
  const startDate = String(task.startDate || "").slice(0, 10);
  const endDate = String(task.endDate || "").slice(0, 10);
  if (!frequency || !startDate || !endDate) return false;
  const start = new Date(`${startDate}T00:00`);
  const end = new Date(`${endDate}T00:00`);
  const current = new Date(`${dateStr}T00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(current.getTime())) return false;
  if (current < start || current > end) return false;
  if (frequency === "daily") return true;
  const dayOfWeek = current.getDay();
  if (frequency === "workday") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (frequency === "weekend") return dayOfWeek === 0 || dayOfWeek === 6;
  const dateNum = current.getDate();
  if (frequency === "odd") return (dayOfWeek >= 1 && dayOfWeek <= 5) && (dateNum % 2 === 1);
  if (frequency === "even") return (dayOfWeek >= 1 && dayOfWeek <= 5) && (dateNum % 2 === 0);
  if (frequency === "once") return dateStr === startDate;
  if (frequency === "weekly" || frequency === "biweekly") {
    const diffDays = Math.floor((current - start) / (24 * 3600 * 1000));
    if (diffDays < 0) return false;
    const step = frequency === "weekly" ? 7 : 14;
    return diffDays % step === 0;
  }
  if (frequency === "monthly") {
    const startDay = start.getDate();
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const expected = Math.min(startDay, daysInMonth);
    return current.getDate() === expected;
  }
  return false;
}

/**
 * 获取当日手动添加的待办列表（仅当天，按日期隔离）。
 * @returns {Array<{text:string,priority:string,done:boolean,startTime?:string,endTime?:string}>}
 */
function getTodayManualTodos() {
  const today = toLocalDateString(new Date());
  if (!appState.todayTodosByDate || typeof appState.todayTodosByDate !== "object") {
    appState.todayTodosByDate = {};
  }
  if (!Array.isArray(appState.todayTodosByDate[today])) {
    appState.todayTodosByDate[today] = [];
  }
  return appState.todayTodosByDate[today];
}

/**
 * 渲染首页待办列表。
 */
function renderTodayTodos() {
  const container = document.getElementById("today-todos");
  if (!container) return;
  container.innerHTML = "";
  const today = toLocalDateString(new Date());
  const scheduleTasks = getScheduleTasksForDate(today)
    .sort((a, b) => getTaskStartAt(a).localeCompare(getTaskStartAt(b)));
  const scheduleTodos = scheduleTasks.map((task) => ({
    text: task.title,
    priority: task.priority || "medium",
    done: task.status === "done",
    source: "schedule",
    taskId: task.id,
    timeRange: formatTimeRange(getTaskStartAt(task), getTaskEndAt(task)),
  }));
  const manualList = getTodayManualTodos();
  const manualTodos = manualList.map((todo, index) => ({
    ...todo,
    source: "manual",
    todoIndex: index,
    timeRange: todo.startTime && todo.endTime ? `${todo.startTime} ~ ${todo.endTime}` : "",
  }));
  const manualCount = manualTodos.length;
  const items = [...scheduleTodos, ...manualTodos];
  items.sort((a, b) => {
    if (a.source === "schedule" && b.source === "schedule") {
      return String(a.timeRange || "").localeCompare(String(b.timeRange || ""));
    }
    if (a.source === "schedule") return -1;
    if (b.source === "schedule") return 1;
    return 0;
  });
  items.forEach((todo) => {
    const item = document.createElement("div");
    item.className = "todo-item";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "todo-check";
    check.checked = todo.done;
    check.addEventListener("change", () => {
      if (todo.source === "schedule") {
        const task = appState.scheduleTasks.find((entry) => entry.id === todo.taskId);
        if (task) task.status = check.checked ? "done" : "pending";
        renderTaskList();
        renderQuarterGoals();
        renderQuarterReview();
        renderGoalReminder();
      } else {
        const list = getTodayManualTodos();
        if (typeof todo.todoIndex === "number" && list[todo.todoIndex]) {
          list[todo.todoIndex].done = check.checked;
        }
      }
      persistLocalState();
      updateStats();
      renderTodayTodos();
    });
    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;
    if (todo.timeRange) {
      const time = document.createElement("span");
      time.className = "todo-time";
      time.textContent = todo.timeRange;
      item.appendChild(time);
    }
    if (todo.source === "manual") {
      const actions = document.createElement("div");
      actions.className = "todo-actions";
      const editBtn = document.createElement("button");
      editBtn.className = "todo-action-btn";
      editBtn.textContent = "编辑";
      editBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        showEditTodo(todo.todoIndex);
      });
      const delBtn = document.createElement("button");
      delBtn.className = "todo-action-btn todo-delete-btn";
      delBtn.textContent = "删除";
      delBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteTodayTodo(todo.todoIndex);
      });
      const upBtn = document.createElement("button");
      upBtn.className = "todo-action-btn";
      upBtn.textContent = "↑";
      upBtn.disabled = todo.todoIndex <= 0;
      upBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        moveTodayTodo(todo.todoIndex, -1);
      });
      const downBtn = document.createElement("button");
      downBtn.className = "todo-action-btn";
      downBtn.textContent = "↓";
      downBtn.disabled = todo.todoIndex >= manualCount - 1;
      downBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        moveTodayTodo(todo.todoIndex, 1);
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      item.appendChild(actions);
    }
    const badge = document.createElement("span");
    badge.className = `todo-priority ${todo.priority}`;
    badge.textContent = todo.done ? "已完成" : (todo.priority === "high" ? "高优先级" : "进行中");
    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(badge);
    container.appendChild(item);
  });
}

/**
 * 计算某文件「有学习痕迹的页数」：只计用户高亮，不含文档自带的旁注（marginNotes 来自 PDF 解析）。
 * @param {string} fileId 文件 id。
 * @returns {{ pagesWithTraces: number, totalPages: number }} 有痕迹页数、总页数。
 */
function getContinueLearningProgress(fileId) {
  const data = appState.workspaceData[fileId];
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const totalPages = pages.length || 0;
  const pagesWithTraces = pages.filter((p) => Array.isArray(p.highlights) && p.highlights.length > 0).length;
  return { pagesWithTraces, totalPages };
}

/**
 * 渲染首页“继续学习”卡片，按最近打开文件动态展示（最多 5 个），进度为有学习痕迹的页数/总页数，支持内部滚轮滚动。
 */
function renderContinueLearning() {
  const container = document.getElementById("continue-learning-container");
  if (!container) return;
  const recent = appState.libraryFiles
    .filter((f) => f.lastOpenedAt)
    .sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)))
    .slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = '<div class="continue-learning-list"><div class="continue-item"><div class="continue-info"><h3>暂无学习文件</h3><p>请先去图书馆上传资料并开始学习。</p></div></div></div>';
    return;
  }
  const itemsHtml = recent
    .map((target) => {
      const data = appState.workspaceData[target.id] || { pages: [], notes: [] };
      const totalPages = Array.isArray(data.pages) ? data.pages.length : 0;
      const { pagesWithTraces } = getContinueLearningProgress(target.id);
      const complete = target.completed === true;
      const percent = totalPages > 0 ? (complete ? 100 : Math.round((pagesWithTraces / totalPages) * 100)) : 0;
      const progress = Math.min(100, Math.max(0, percent));
      const labelText = totalPages > 0 ? `${pagesWithTraces}/${totalPages} 页 · ${percent}%` : "—";
      const path = buildCategoryPath(target.categoryId) || "未分类";
      return `
    <div class="continue-item" onclick="openDocument('${escapeHtml(target.id)}')">
      <div class="continue-cover">📄</div>
      <div class="continue-info">
        <h3>${escapeHtml(target.name)}</h3>
        <p>${escapeHtml(path)} · ${escapeHtml(target.type)} · ${totalPages || "未知"}页</p>
        <div class="continue-progress-row">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-label">${escapeHtml(labelText)}</span>
        </div>
      </div>
      <span class="continue-arrow">${complete ? "✓" : "→"}</span>
    </div>`;
    })
    .join("");
  container.innerHTML = `<div class="continue-learning-list">${itemsHtml}</div>`;
}

/**
 * 获取最近打开的文件对象。
 * @returns {{id:string,name:string,type:string,categoryId:string,completed?:boolean}|null} 文件对象。
 */
function getLastOpenedFile() {
  const files = appState.libraryFiles
    .filter((item) => item.lastOpenedAt)
    .sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)));
  return files[0] || null;
}

/**
 * 新增首页待办项（仅当天）。
 */
function showAddTodo() {
  runtimeState.todoEditIndex = undefined;
  setValue("todo-content-input", "");
  setValue("todo-priority-input", "medium");
  setValue("todo-start-time", "09:00");
  setValue("todo-end-time", "10:00");
  const modal = document.getElementById("todo-modal");
  const titleEl = modal?.querySelector(".modal-header h2");
  const submitBtn = modal?.querySelector(".modal-footer .btn-primary");
  if (titleEl) titleEl.textContent = "✅ 新增今日待办";
  if (submitBtn) submitBtn.textContent = "添加";
  if (modal) modal.classList.add("show");
}

/**
 * 编辑当日手动待办（打开弹窗并预填）。
 * @param {number} index 在当日手动待办列表中的下标。
 */
function showEditTodo(index) {
  const list = getTodayManualTodos();
  const todo = list[index];
  if (!todo) return;
  runtimeState.todoEditIndex = index;
  setValue("todo-content-input", todo.text || "");
  setValue("todo-priority-input", todo.priority || "medium");
  setValue("todo-start-time", todo.startTime || "09:00");
  setValue("todo-end-time", todo.endTime || "10:00");
  const modal = document.getElementById("todo-modal");
  const titleEl = modal?.querySelector(".modal-header h2");
  const submitBtn = modal?.querySelector(".modal-footer .btn-primary");
  if (titleEl) titleEl.textContent = "✏️ 编辑今日待办";
  if (submitBtn) submitBtn.textContent = "保存";
  if (modal) modal.classList.add("show");
}

/**
 * 删除当日手动待办。
 * @param {number} index 在当日手动待办列表中的下标。
 */
function deleteTodayTodo(index) {
  const list = getTodayManualTodos();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  renderTodayTodos();
  persistLocalState();
  updateStats();
}

/**
 * 提交首页待办弹窗表单（新增或保存编辑，仅写入当日列表）。
 */
function submitTodoModal() {
  const content = getValue("todo-content-input");
  const priority = getValue("todo-priority-input") || "medium";
  const startTime = getValue("todo-start-time");
  const endTime = getValue("todo-end-time");
  if (!content) {
    showAppAlert("请先输入待办内容。");
    return;
  }
  if (!startTime || !endTime) {
    showAppAlert("请设置待办时间区间。");
    return;
  }
  if (startTime >= endTime) {
    showAppAlert("开始时间需早于结束时间。");
    return;
  }
  const list = getTodayManualTodos();
  const editIndex = runtimeState.todoEditIndex;
  if (typeof editIndex === "number" && editIndex >= 0 && editIndex < list.length) {
    list[editIndex] = { ...list[editIndex], text: content, priority, startTime, endTime };
    runtimeState.todoEditIndex = undefined;
  } else {
    list.push({ text: content, priority, done: false, startTime, endTime });
  }
  renderTodayTodos();
  closeModal("todo-modal");
  persistLocalState();
  updateStats();
}

function moveTodayTodo(index, direction) {
  const list = getTodayManualTodos();
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.length) return;
  const temp = list[index];
  list[index] = list[nextIndex];
  list[nextIndex] = temp;
  renderTodayTodos();
  persistLocalState();
}

/**
 * 渲染图书馆分类树（支持多层和折叠）。
 */
function renderLibraryCategoryTree() {
  const tree = document.getElementById("category-tree");
  if (!tree) return;
  tree.innerHTML = "";
  const roots = appState.libraryCategories.filter((cat) => !cat.parentId);
  roots.forEach((root) => tree.appendChild(createCategoryNode(root, 0)));
}

/**
 * 递归生成单个分类节点。
 * @param {{id:string,name:string,icon:string,parentId:string|null}} category 分类对象。
 * @param {number} depth 层级深度。
 * @returns {HTMLElement} 节点容器。
 */
function createCategoryNode(category, depth) {
  const wrapper = document.createElement("div");
  const children = appState.libraryCategories.filter((cat) => cat.parentId === category.id);
  const collapsed = appState.collapsedCategoryIds.includes(category.id);
  const fileCount = countFilesInCategory(category.id);

  const item = document.createElement("div");
  item.className = `category-item${appState.selectedCategoryId === category.id ? " active" : ""}`;
  item.dataset.categoryId = category.id;
  item.style.paddingLeft = `${8 + depth * 10}px`;

  const togglePart = children.length > 0
    ? `<button class="tree-toggle" data-category-id="${category.id}" title="折叠/展开">${collapsed ? "▸" : "▾"}</button>`
    : '<span class="tree-empty-dot">•</span>';
  item.innerHTML = `${togglePart}<span class="category-icon">${escapeHtml(category.icon || "📁")}</span><span class="category-name">${escapeHtml(category.name)}</span><span class="category-count">${fileCount}</span>`;
  wrapper.appendChild(item);

  if (!collapsed && children.length > 0) {
    const childWrap = document.createElement("div");
    childWrap.className = "category-children";
    children.forEach((child) => childWrap.appendChild(createCategoryNode(child, depth + 1)));
    wrapper.appendChild(childWrap);
  }
  return wrapper;
}

/**
 * 切换分类折叠状态。
 * @param {string} categoryId 分类 id。
 */
function toggleCategoryCollapsed(categoryId) {
  const exists = appState.collapsedCategoryIds.includes(categoryId);
  if (exists) {
    appState.collapsedCategoryIds = appState.collapsedCategoryIds.filter((id) => id !== categoryId);
  } else {
    appState.collapsedCategoryIds.push(categoryId);
  }
  renderLibraryCategoryTree();
  persistLocalState();
}

/**
 * 统计分类及其子分类的文件数量。
 * @param {string} categoryId 分类 id。
 * @returns {number} 文件数量。
 */
function countFilesInCategory(categoryId) {
  const ids = getDescendantCategoryIds(categoryId);
  return appState.libraryFiles.filter((file) => ids.includes(file.categoryId)).length;
}

/**
 * 获取某分类下的全部后代分类 id。
 * @param {string} categoryId 分类 id。
 * @returns {string[]} 分类 id 列表。
 */
function getDescendantCategoryIds(categoryId) {
  const result = [categoryId];
  const dfs = (id) => {
    appState.libraryCategories
      .filter((cat) => cat.parentId === id)
      .forEach((child) => {
        result.push(child.id);
        dfs(child.id);
      });
  };
  dfs(categoryId);
  return result;
}

/**
 * 渲染当前分类下的子目录和文件卡片。
 */
function renderLibraryFiles() {
  const grid = document.getElementById("files-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const selected = appState.selectedCategoryId;
  const childFolders = appState.libraryCategories.filter((cat) => cat.parentId === selected);
  const files = getFilteredAndSortedLibraryFiles(selected);
  const pageSize = sanitizeCount(String(appState.libraryPageSize || 12), 12, 24);
  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));
  const currentPage = Math.min(Math.max(1, appState.libraryPage || 1), totalPages);
  appState.libraryPage = currentPage;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedFiles = files.slice(startIndex, endIndex);

  childFolders.forEach((folder) => {
    const card = document.createElement("div");
    card.className = "file-card folder-card";
    card.innerHTML = `<div class="file-icon">${escapeHtml(folder.icon || "📁")}</div><div class="file-info"><h3>${escapeHtml(folder.name)}</h3><p>子分类文件夹</p></div><div class="continue-arrow">→</div>`;
    card.addEventListener("click", () => {
      appState.selectedCategoryId = folder.id;
      appState.libraryPage = 1;
      renderLibraryCategoryTree();
      renderLibraryFiles();
      populateUploadCategoryOptions();
    });
    grid.appendChild(card);
  });

  pagedFiles.forEach((file) => {
    const card = document.createElement("div");
    card.className = "file-card";
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.setData("text/plain", file.id);
      event.dataTransfer.effectAllowed = "move";
    });
    if (appState.librarySelectionEnabled) {
      card.addEventListener("click", () => toggleSelectFile(file.id));
    } else {
      card.addEventListener("click", () => openDocument(file.id));
    }

    const openText = file.lastOpenedAt ? `上次学习：${formatDateTimeDisplay(file.lastOpenedAt)}` : "上次学习：未打开";
    const status = getLearningStatus(file);
    const statusBadge = getLearningStatusBadge(status);
    const isSelected = appState.selectedFileIds.includes(file.id);
    const selectHtml = appState.librarySelectionEnabled
      ? `<input type="checkbox" class="file-select" ${isSelected ? "checked" : ""} onclick="toggleSelectFile('${escapeHtml(file.id)}');event.stopPropagation();">`
      : "";
    card.innerHTML = `${selectHtml}<div class="file-icon">📄</div><div class="file-info"><h3>${escapeHtml(file.name)} ${statusBadge}</h3><p>${escapeHtml(file.type)} · ${escapeHtml(file.size)} · ${escapeHtml(file.pages)}</p><p class="file-date">添加于 ${escapeHtml(file.addedAt)}</p><p class="file-last-open">${escapeHtml(openText)}</p></div><div class="file-actions"><button class="action-btn" title="AI分析">🤖</button><button class="action-btn" title="删除">🗑️</button></div>`;
    const buttons = card.querySelectorAll(".action-btn");
    if (buttons[0]) {
      buttons[0].addEventListener("click", (event) => {
        event.stopPropagation();
        analyzeDoc(file.id);
      });
    }
    if (buttons[1] && !appState.librarySelectionEnabled) {
      buttons[1].addEventListener("click", (event) => {
        event.stopPropagation();
        deleteFile(file.id);
      });
    }
    grid.appendChild(card);
  });

  const addCard = document.createElement("div");
  addCard.className = "file-card add-file";
  addCard.innerHTML = '<div class="add-icon">+</div><p>点击上传文件</p>';
  addCard.addEventListener("click", showUploadModal);
  grid.appendChild(addCard);
  updateLibraryPaginationUI(currentPage, totalPages, files.length);
  updateLibrarySelectionUI();
}

function updateLibraryPaginationUI(currentPage, totalPages, totalItems) {
  const prevBtn = document.getElementById("files-prev-btn");
  const nextBtn = document.getElementById("files-next-btn");
  const info = document.getElementById("files-page-info");
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (info) info.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${totalItems} 项`;
}

function changeLibraryPage(delta) {
  const next = (appState.libraryPage || 1) + delta;
  appState.libraryPage = Math.max(1, next);
  renderLibraryFiles();
}

function toggleLibrarySelection() {
  appState.librarySelectionEnabled = !appState.librarySelectionEnabled;
  if (!appState.librarySelectionEnabled) {
    appState.selectedFileIds = [];
  }
  renderLibraryFiles();
}

function toggleSelectFile(fileId) {
  const idx = appState.selectedFileIds.indexOf(fileId);
  if (idx >= 0) {
    appState.selectedFileIds.splice(idx, 1);
  } else {
    appState.selectedFileIds.push(fileId);
  }
  updateLibrarySelectionUI();
}

function selectAllLibraryFiles() {
  const selected = appState.selectedCategoryId;
  const files = getFilteredAndSortedLibraryFiles(selected);
  const pageSize = sanitizeCount(String(appState.libraryPageSize || 12), 12, 24);
  const currentPage = appState.libraryPage || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedFiles = files.slice(startIndex, endIndex);
  appState.selectedFileIds = pagedFiles.map((f) => f.id);
  updateLibrarySelectionUI();
  renderLibraryFiles();
}

function clearLibrarySelection() {
  appState.selectedFileIds = [];
  updateLibrarySelectionUI();
  renderLibraryFiles();
}

async function deleteSelectedLibraryFiles() {
  if (!appState.librarySelectionEnabled || appState.selectedFileIds.length === 0) return;
  const names = appState.libraryFiles
    .filter((f) => appState.selectedFileIds.includes(f.id))
    .map((f) => f.name)
    .slice(0, 3)
    .join("、");
  const ok = await showAppConfirm(`确认删除所选 ${appState.selectedFileIds.length} 个文件${names ? `（例如：${names}）` : ""}吗？`);
  if (!ok) return;
  await deleteLibraryFilesByIds(appState.selectedFileIds);
  appState.selectedFileIds = [];
  updateLibrarySelectionUI();
  renderLibraryCategoryTree();
  renderLibraryFiles();
  renderContinueLearning();
  populateWorkspaceFileOptions();
  void loadActiveWorkspaceFile();
  persistLocalState();
  updateStats();
}

async function deleteLibraryFilesByIds(fileIds) {
  const set = new Set(fileIds);
  const filesToDelete = appState.libraryFiles.filter((file) => set.has(file.id));
  await Promise.all(filesToDelete.map((file) => deletePdfBlob(file.id)));
  filesToDelete.forEach((file) => {
    clearPdfDocCache(file.id);
    delete appState.workspaceData[file.id];
  });
  appState.libraryFiles = appState.libraryFiles.filter((file) => !set.has(file.id));
  if (appState.activeFileId && set.has(appState.activeFileId)) {
    appState.activeFileId = appState.libraryFiles[0]?.id || "";
  }
}

function updateLibrarySelectionUI() {
  const toggleBtn = document.getElementById("library-select-toggle");
  const delBtn = document.getElementById("library-select-delete");
  const allBtn = document.getElementById("library-select-all");
  const clearBtn = document.getElementById("library-select-clear");
  const enabled = appState.librarySelectionEnabled;
  if (toggleBtn) toggleBtn.textContent = enabled ? "退出选择" : "批量选择";
  const hasSelected = appState.selectedFileIds.length > 0;
  if (delBtn) delBtn.disabled = !enabled || !hasSelected;
  if (allBtn) allBtn.disabled = !enabled;
  if (clearBtn) clearBtn.disabled = !enabled || !hasSelected;
}

/**
 * 获取图书馆文件筛选与排序后的列表。
 * @param {string} categoryId 当前分类 id。
 * @returns {Array<any>} 过滤排序后的文件数组。
 */
function getFilteredAndSortedLibraryFiles(categoryId) {
  const inCategory = appState.libraryFiles.filter((file) => file.categoryId === categoryId);
  if (window.ClawMindLibrary?.getFilteredAndSortedLibraryFiles) {
    return window.ClawMindLibrary.getFilteredAndSortedLibraryFiles(
      inCategory,
      appState.librarySortBy,
      appState.libraryStatusFilter,
    );
  }
  return inCategory;
}

/**
 * 计算文件学习状态：未学习 / 学习中 / 已学习完。
 * @param {{lastOpenedAt?:string,completed?:boolean}} file 文件对象。
 * @returns {"unlearned"|"in_progress"|"completed"} 学习状态。
 */
function getLearningStatus(file) {
  if (window.ClawMindLibrary?.getLearningStatus) {
    return window.ClawMindLibrary.getLearningStatus(file);
  }
  if (file.completed) return "completed";
  if (file.lastOpenedAt) return "in_progress";
  return "unlearned";
}

/**
 * 根据学习状态返回对应徽标 HTML。
 * @param {"unlearned"|"in_progress"|"completed"} status 学习状态。
 * @returns {string} 状态徽标 HTML。
 */
function getLearningStatusBadge(status) {
  if (window.ClawMindLibrary?.getLearningStatusBadgeByStatus) {
    return window.ClawMindLibrary.getLearningStatusBadgeByStatus(status);
  }
  if (status === "completed") return '<span class="learned-badge">已学习完</span>';
  if (status === "in_progress") return '<span class="learning-badge">学习中</span>';
  return '<span class="unlearned-badge">未学习</span>';
}

/**
 * 将可解析时间转换成毫秒时间戳，不可解析时返回 0。
 * @param {string|undefined} value 时间字符串。
 * @returns {number} 时间戳。
 */
function safeTime(value) {
  if (window.ClawMindLibrary?.safeTime) {
    return window.ClawMindLibrary.safeTime(value);
  }
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 将文件移动到指定分类（拖拽放置）。
 * @param {string} fileId 文件 id。
 * @param {string} categoryId 分类 id。
 */
function moveFileToCategory(fileId, categoryId) {
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  if (!file) return;
  file.categoryId = categoryId;
  persistLocalState();
  renderLibraryCategoryTree();
  renderLibraryFiles();
  updateStats();
}

/**
 * 打开“新建分类”弹窗。
 */
function showNewCategory() {
  populateCategoryParentOptions();
  setValue("category-name-input", "");
  setValue("category-icon-input", "");
  const modal = document.getElementById("category-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 新建分类并支持父子层级。
 */
function submitNewCategory() {
  const name = getValue("category-name-input");
  const icon = getValue("category-icon-input") || "📁";
  const parentId = getValue("category-parent-select") || null;
  if (!name) {
    showAppAlert("分类名称不能为空。");
    return;
  }
  const duplicated = appState.libraryCategories.some((cat) => cat.parentId === parentId && cat.name === name);
  if (duplicated) {
    showAppAlert("同级分类重名，请更换名称。");
    return;
  }
  const category = { id: `cat-${Date.now()}`, name, icon, parentId };
  appState.libraryCategories.push(category);
  appState.selectedCategoryId = category.id;
  renderLibraryCategoryTree();
  renderLibraryFiles();
  populateUploadCategoryOptions();
  persistLocalState();
  closeModal("category-modal");
}

/**
 * 重命名当前选中分类。
 */
function renameCurrentCategory() {
  const current = appState.libraryCategories.find((cat) => cat.id === appState.selectedCategoryId);
  if (!current) return;
  runtimeState.renameCategoryModal.categoryId = current.id;
  setValue("rename-category-name-input", current.name || "");
  const modal = document.getElementById("rename-category-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 提交分类重命名弹窗。
 */
function submitRenameCategoryModal() {
  const categoryId = runtimeState.renameCategoryModal.categoryId;
  const current = appState.libraryCategories.find((cat) => cat.id === categoryId);
  if (!current) {
    showAppAlert("未找到要重命名的分类。");
    return;
  }
  const nextName = getValue("rename-category-name-input");
  if (!nextName) {
    showAppAlert("请输入新的分类名称。");
    return;
  }
  const duplicated = appState.libraryCategories.some((cat) => (
    cat.id !== current.id
    && cat.parentId === current.parentId
    && cat.name === nextName
  ));
  if (duplicated) {
    showAppAlert("同级分类重名，请更换名称。");
    return;
  }
  current.name = nextName;
  renderLibraryCategoryTree();
  renderLibraryFiles();
  populateUploadCategoryOptions();
  closeModal("rename-category-modal");
  persistLocalState();
}

/**
 * 删除当前分类（要求无子分类且无文件）。
 */
async function deleteCurrentCategory() {
  const current = appState.libraryCategories.find((cat) => cat.id === appState.selectedCategoryId);
  if (!current) return;
  const descendants = getDescendantCategoryIds(current.id);
  const fileCount = appState.libraryFiles.filter((file) => descendants.includes(file.categoryId)).length;
  if (appState.libraryCategories.length <= descendants.length) {
    showAppAlert("至少保留一个分类，无法删除当前分类。");
    return;
  }
  const ok = await showAppConfirm(`确认删除分类「${current.name}」吗？该分类及子分类下的 ${fileCount} 个文件将被永久删除。`);
  if (!ok) return;
  const filesToDelete = appState.libraryFiles.filter((file) => descendants.includes(file.categoryId));
  await Promise.all(filesToDelete.map((file) => deletePdfBlob(file.id)));
  filesToDelete.forEach((file) => {
    clearPdfDocCache(file.id);
    delete appState.workspaceData[file.id];
  });
  appState.libraryFiles = appState.libraryFiles.filter((file) => !descendants.includes(file.categoryId));
  if (appState.activeFileId && filesToDelete.some((file) => file.id === appState.activeFileId)) {
    appState.activeFileId = appState.libraryFiles[0]?.id || "";
  }
  const remainingCategories = appState.libraryCategories.filter((cat) => !descendants.includes(cat.id));
  const fallbackCategoryId = remainingCategories.find((cat) => cat.id === current.parentId)?.id
    || remainingCategories[0]?.id
    || "";
  appState.libraryCategories = remainingCategories;
  appState.collapsedCategoryIds = appState.collapsedCategoryIds.filter((id) => !descendants.includes(id));
  appState.selectedCategoryId = fallbackCategoryId;
  renderLibraryCategoryTree();
  renderLibraryFiles();
  populateUploadCategoryOptions();
  renderContinueLearning();
  populateWorkspaceFileOptions();
  void loadActiveWorkspaceFile();
  persistLocalState();
  updateStats();
}

/**
 * 渲染上传分类下拉。
 */
function populateUploadCategoryOptions() {
  const select = document.getElementById("upload-category-select");
  if (!select) return;
  select.innerHTML = "";
  appState.libraryCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon || "📁"} ${buildCategoryPath(category.id)}`;
    if (category.id === appState.selectedCategoryId) option.selected = true;
    select.appendChild(option);
  });
}

/**
 * 渲染父级分类下拉。
 */
function populateCategoryParentOptions() {
  const select = document.getElementById("category-parent-select");
  if (!select) return;
  select.innerHTML = '<option value="">作为顶层分类</option>';
  appState.libraryCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon || "📁"} ${buildCategoryPath(category.id)}`;
    if (category.id === appState.selectedCategoryId) option.selected = true;
    select.appendChild(option);
  });
}

/**
 * 构建分类全路径文本。
 * @param {string} categoryId 分类 id。
 * @returns {string} 分类路径。
 */
function buildCategoryPath(categoryId) {
  const names = [];
  let cursor = appState.libraryCategories.find((cat) => cat.id === categoryId);
  while (cursor) {
    names.unshift(cursor.name);
    cursor = appState.libraryCategories.find((cat) => cat.id === cursor.parentId);
  }
  return names.join(" / ");
}

/**
 * 显示上传弹窗。
 */
function showUploadModal() {
  populateUploadCategoryOptions();
  const modal = document.getElementById("upload-modal");
  if (modal) modal.classList.add("show");
}

function setUploadProgressVisible(visible) {
  const container = document.getElementById("upload-progress");
  if (!container) return;
  container.style.display = visible ? "block" : "none";
}

function updateUploadProgress(done, total, text) {
  const bar = document.getElementById("upload-progress-bar");
  const label = document.getElementById("upload-progress-text");
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = text || `上传中 ${done}/${total}`;
}

function setUploadBusy(busy) {
  const confirmBtn = document.getElementById("upload-confirm-btn");
  const input = document.getElementById("file-input");
  if (confirmBtn) confirmBtn.disabled = busy;
  if (input) input.disabled = busy;
  runtimeState.upload.busy = busy;
}

/**
 * 上传文件并加入分类。
 */
async function uploadFile() {
  if (runtimeState.upload.busy) return;
  const input = document.getElementById("file-input");
  if (!input || !input.files || input.files.length === 0) {
    showAppAlert("请先选择文件。");
    return;
  }
  await uploadFiles(Array.from(input.files));
  input.value = "";
}

/**
 * 批量上传多个文件，支持拖拽与文件选择。
 * @param {File[]} files 文件数组。
 */
async function uploadFiles(files) {
  if (runtimeState.upload.busy) return;
  const categoryId = getValue("upload-category-select") || appState.selectedCategoryId;
  const accepted = files.filter((file) => /\.(pdf|md|docx|doc|pptx|ppt|txt)$/i.test(file.name));
  if (accepted.length === 0) {
    showAppAlert("未检测到可支持的文件类型（PDF/MD/DOCX/DOC/PPTX/PPT/TXT）。");
    return;
  }
  setUploadBusy(true);
  setUploadProgressVisible(true);
  updateUploadProgress(0, accepted.length, `准备上传 ${accepted.length} 个文件`);
  let lastFileId = "";
  try {
    for (let i = 0; i < accepted.length; i += 1) {
      updateUploadProgress(i, accepted.length, `正在处理：${accepted[i].name}`);
      const fileId = await uploadSingleFile(accepted[i], categoryId);
      if (fileId) lastFileId = fileId;
      updateUploadProgress(i + 1, accepted.length, `已完成 ${i + 1}/${accepted.length}`);
    }
    if (lastFileId) {
      appState.selectedCategoryId = categoryId;
      appState.activeFileId = lastFileId;
      appState.currentDocPage = 1;
      appState.libraryPage = 1;
      renderLibraryCategoryTree();
      renderLibraryFiles();
      renderContinueLearning();
      populateWorkspaceFileOptions();
      await loadActiveWorkspaceFile();
      updateStats();
      persistLocalState();
      closeModal("upload-modal");
    }
  } finally {
    setUploadBusy(false);
    setTimeout(() => setUploadProgressVisible(false), 600);
  }
}

/**
 * 上传单个文件并初始化对应工作区数据。
 * @param {File} fileObj 文件对象。
 * @param {string} categoryId 目标分类 id。
 * @returns {Promise<string>} 新文件 id。
 */
async function uploadSingleFile(fileObj, categoryId) {
  const ext = fileObj.name.includes(".") ? fileObj.name.split(".").pop().toUpperCase() : "FILE";
  const pureName = fileObj.name.replace(/\.[^/.]+$/, "");
  const id = `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const isPdf = ext === "PDF";
  const isTextLike = ext === "TXT" || ext === "MD";
  const isWord = ext === "DOCX" || ext === "DOC";
  const isPpt = ext === "PPTX" || ext === "PPT";

  if (isPdf) {
    await savePdfBlob(id, fileObj);
  }

  appState.libraryFiles.push({
    id,
    name: pureName,
    type: ext,
    size: `${Math.max(1, Math.round(fileObj.size / 1024))}KB`,
    pages: ext === "PDF" ? "未知页数" : "N/A",
    addedAt: new Date().toISOString().split("T")[0],
    categoryId,
    lastOpenedAt: "",
    completed: false,
    completedAt: "",
  });
  appState.workspaceData[id] = { pages: [], notes: [], vocab: [], savedAt: null };

  if (isPdf) {
    const pdfPages = await extractPdfPagesFromFile(fileObj);
    appState.workspaceData[id].pages = pdfPages.length > 0
      ? pdfPages
      : [{ html: `<p><strong>${escapeHtml(pureName)}</strong></p><p>PDF 解析失败，当前以占位内容展示。</p>`, highlights: [], marginNotes: [] }];
  } else if (isTextLike) {
    const rawText = await fileObj.text().catch(() => "");
    const html = ext === "MD"
      ? markdownToHtml(rawText, pureName)
      : plainTextToHtml(rawText, pureName);
    appState.workspaceData[id].pages = [{ html, highlights: [], marginNotes: [] }];
  } else if (isWord) {
    const html = ext === "DOCX"
      ? await extractDocxHtmlFromFile(fileObj, pureName)
      : `<p><strong>${escapeHtml(pureName)}</strong></p><p>DOC 老格式暂不支持完整版式还原，建议转换为 DOCX 或 PDF 以获得更接近原样的展示。</p>`;
    appState.workspaceData[id].pages = [{ html, highlights: [], marginNotes: [] }];
  } else if (isPpt) {
    appState.workspaceData[id].pages = ext === "PPTX"
      ? await extractPptxPagesFromFile(fileObj, pureName)
      : [{ html: `<p><strong>${escapeHtml(pureName)}</strong></p><p>PPT 老格式暂不支持完整版式还原，建议转换为 PPTX 或 PDF 以获得更接近原样的展示。</p>`, highlights: [], marginNotes: [] }];
    if (!Array.isArray(appState.workspaceData[id].pages) || appState.workspaceData[id].pages.length === 0) {
      appState.workspaceData[id].pages = [{ html: `<p><strong>${escapeHtml(pureName)}</strong></p><p>PPT 解析失败，当前以文本占位展示。</p>`, highlights: [], marginNotes: [] }];
    }
  } else {
    appState.workspaceData[id].pages = [
      { html: `<p><strong>${escapeHtml(pureName)}</strong></p><p>这是新上传文件的学习区内容占位。你可以在工作区进行高亮、笔记和提炼操作。</p>`, highlights: [], marginNotes: [] },
    ];
  }
  await uploadFileToServerIngest(fileObj);
  return id;
}

function plainTextToHtml(rawText, title) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0
    ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    : `<p><strong>${escapeHtml(title)}</strong></p><p>文本为空，当前以占位内容展示。</p>`;
}

function markdownToHtml(rawText, title) {
  const source = String(rawText || "").trim();
  if (!source) return `<p><strong>${escapeHtml(title)}</strong></p><p>Markdown 内容为空。</p>`;
  if (window.marked && typeof window.marked.parse === "function") {
    try {
      return String(window.marked.parse(source));
    } catch {
    }
  }
  return plainTextToHtml(source, title);
}

async function extractDocxHtmlFromFile(fileObj, title) {
  if (!window.mammoth || typeof window.mammoth.convertToHtml !== "function") {
    return `<p><strong>${escapeHtml(title)}</strong></p><p>DOCX 预览依赖未加载，当前降级为占位展示。</p>`;
  }
  try {
    const buffer = await fileObj.arrayBuffer();
    const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = String(result?.value || "").trim();
    if (!html) return `<p><strong>${escapeHtml(title)}</strong></p><p>DOCX 内容为空。</p>`;
    return html;
  } catch {
    return `<p><strong>${escapeHtml(title)}</strong></p><p>DOCX 解析失败，建议转换为 PDF 以保留原始版式。</p>`;
  }
}

async function extractPptxPagesFromFile(fileObj, title) {
  if (!window.JSZip || typeof window.JSZip.loadAsync !== "function") {
    return [{ html: `<p><strong>${escapeHtml(title)}</strong></p><p>PPTX 解析依赖未加载，当前降级为占位展示。</p>`, highlights: [], marginNotes: [] }];
  }
  try {
    const zip = await window.JSZip.loadAsync(await fileObj.arrayBuffer());
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = Number((a.match(/slide(\d+)\.xml/i) || [])[1] || 0);
        const nb = Number((b.match(/slide(\d+)\.xml/i) || [])[1] || 0);
        return na - nb;
      });
    if (slideFiles.length === 0) {
      return [{ html: `<p><strong>${escapeHtml(title)}</strong></p><p>未检测到可解析的幻灯片内容。</p>`, highlights: [], marginNotes: [] }];
    }
    const pages = [];
    for (let i = 0; i < slideFiles.length; i += 1) {
      const xml = await zip.files[slideFiles[i]].async("text");
      const textMatches = [...String(xml || "").matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)];
      const lines = textMatches
        .map((m) => decodeXmlEntities(String(m[1] || "")))
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const html = lines.length > 0
        ? `<p><strong>Slide ${i + 1}</strong></p>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}`
        : `<p><strong>Slide ${i + 1}</strong></p><p>该页暂无可提取文字。</p>`;
      pages.push({ html, highlights: [], marginNotes: [] });
    }
    return pages;
  } catch {
    return [{ html: `<p><strong>${escapeHtml(title)}</strong></p><p>PPTX 解析失败，建议转换为 PDF 以保留原始版式。</p>`, highlights: [], marginNotes: [] }];
  }
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

/**
 * 关闭指定模态框。
 * @param {string} id 模态框 id。
 */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("show");
  if (id === "todo-modal") {
    setValue("todo-content-input", "");
    setValue("todo-priority-input", "medium");
  }
  if (id === "rename-category-modal") {
    runtimeState.renameCategoryModal.categoryId = "";
    setValue("rename-category-name-input", "");
  }
  if (id === "auth-modal") {
    setValue("auth-password-input", "");
    setAuthModalMessage("");
  }
  if (id === "question-category-modal") {
    setValue("question-category-name-input", "");
  }
  if (id === "question-category-edit-modal") {
    setValue("question-category-edit-input", "");
  }
  if (id === "vocab-modal") {
    runtimeState.vocabModal.mode = "create";
    runtimeState.vocabModal.editingId = "";
    setValue("vocab-word-input", "");
    setValue("vocab-meaning-input", "");
  }
  if (id === "task-modal") {
    runtimeState.taskEdit.mode = "create";
    runtimeState.taskEdit.taskId = "";
    runtimeState.taskEdit.seriesId = "";
    updateTaskModalUi();
  }
  if (id === "year-goal-modal") {
    runtimeState.goalModal.mode = "create";
    runtimeState.goalModal.type = "year";
    runtimeState.goalModal.goalId = "";
    setValue("year-goal-year", String(new Date().getFullYear()));
    setValue("year-goal-title", "");
    setValue("year-goal-desc", "");
    setValue("year-goal-status", "active");
  }
  if (id === "quarter-goal-modal") {
    runtimeState.goalModal.mode = "create";
    runtimeState.goalModal.type = "quarter";
    runtimeState.goalModal.goalId = "";
    setValue("quarter-goal-title", "");
    setValue("quarter-goal-desc", "");
    setValue("quarter-goal-status", "active");
  }
  if (id === "kr-modal") {
    runtimeState.krModal.mode = "create";
    runtimeState.krModal.krId = "";
    runtimeState.krModal.goalId = "";
    setValue("kr-title", "");
    setValue("kr-target", "");
    setValue("kr-current", "");
    setValue("kr-unit", "");
    setValue("kr-status", "active");
  }
  if (id === "kr-task-modal") {
    runtimeState.krTaskModal.krId = "";
    const list = document.getElementById("kr-task-modal-list");
    if (list) list.innerHTML = "";
  }
  if (id === "goal-task-modal") {
    runtimeState.goalTaskModal.goalId = "";
    const list = document.getElementById("goal-task-modal-list");
    if (list) list.innerHTML = "";
  }
  if (id === "app-dialog-modal") {
    runtimeState.dialog.resolver = null;
  }
}

/**
 * 打开统一提示弹窗（替代 alert）。
 * @param {string} message 提示内容。
 * @param {string} title 标题文本。
 */
function showAppAlert(message, title = "提示") {
  setText("app-dialog-title", title);
  setText("app-dialog-message", String(message || ""));
  setText("app-dialog-confirm-btn", "我知道了");
  const cancelBtn = document.getElementById("app-dialog-cancel-btn");
  if (cancelBtn) cancelBtn.style.display = "none";
  runtimeState.dialog.resolver = null;
  const modal = document.getElementById("app-dialog-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 打开统一确认弹窗（替代 confirm）。
 * @param {string} message 确认内容。
 * @param {string} title 标题文本。
 * @returns {Promise<boolean>} 用户是否确认。
 */
function showAppConfirm(message, title = "请确认") {
  setText("app-dialog-title", title);
  setText("app-dialog-message", String(message || ""));
  setText("app-dialog-confirm-btn", "确认");
  const cancelBtn = document.getElementById("app-dialog-cancel-btn");
  if (cancelBtn) cancelBtn.style.display = "inline-flex";
  const modal = document.getElementById("app-dialog-modal");
  if (modal) modal.classList.add("show");
  return new Promise((resolve) => {
    runtimeState.dialog.resolver = resolve;
  });
}

/**
 * 统一弹窗“确认”按钮处理。
 */
function confirmAppDialog() {
  const resolver = runtimeState.dialog.resolver;
  closeModal("app-dialog-modal");
  if (typeof resolver === "function") resolver(true);
}

/**
 * 统一弹窗“取消/关闭”按钮处理。
 */
function cancelAppDialog() {
  const resolver = runtimeState.dialog.resolver;
  closeModal("app-dialog-modal");
  if (typeof resolver === "function") resolver(false);
}

/**
 * 打开文档到工作区并刷新学习记录。
 * @param {string} fileId 文件 id。
 */
async function openDocument(fileId) {
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  if (!file) return;
  appState.activeFileId = fileId;
  appState.currentDocPage = 1;
  file.lastOpenedAt = new Date().toISOString();
  syncLearningRecordByFile(fileId);
  await loadActiveWorkspaceFile();
  renderReviewTimeline();
  populateWorkspaceFileOptions();
  renderLibraryFiles();
  renderContinueLearning();
  syncWorkspaceCompleteButton();
  persistLocalState();
  navigateTo("workspace");
}

/**
 * 渲染工作区「路径」下拉（第一步），并刷新「文件」列表（第二步）。
 */
function populateWorkspaceFileOptions() {
  const categorySelect = document.getElementById("workspace-category-select");
  if (!categorySelect) return;

  const categoryIdsWithFiles = [...new Set(appState.libraryFiles.map((f) => f.categoryId).filter(Boolean))];
  const categoryOptions = [{ value: "", label: "全部" }];
  categoryIdsWithFiles.forEach((cid) => {
    categoryOptions.push({ value: cid, label: buildCategoryPath(cid) || "未分类" });
  });
  const activeFile = appState.libraryFiles.find((f) => f.id === appState.activeFileId);
  const selectedCategoryId = activeFile ? (activeFile.categoryId || "") : "";

  categorySelect.innerHTML = "";
  categoryOptions.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (option.value === selectedCategoryId) option.selected = true;
    categorySelect.appendChild(option);
  });

  populateWorkspaceFileList();
  syncWorkspacePathDisplay();
}

/**
 * 根据当前选中的路径和关键字，填充工作区「文件」下拉（第二步）。
 */
function populateWorkspaceFileList() {
  const categorySelect = document.getElementById("workspace-category-select");
  const fileSelect = document.getElementById("workspace-file-select");
  const searchInput = document.getElementById("workspace-file-search");
  if (!fileSelect) return;

  const categoryId = categorySelect ? categorySelect.value : "";
  const keyword = (searchInput && searchInput.value.trim()) || "";
  const keywordLower = keyword.toLowerCase();

  let files = appState.libraryFiles.filter((f) => !categoryId || f.categoryId === categoryId);
  if (keywordLower) {
    files = files.filter((f) => f.name.toLowerCase().includes(keywordLower));
  }
  files.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  fileSelect.innerHTML = "";
  files.forEach((file) => {
    const option = document.createElement("option");
    option.value = file.id;
    option.textContent = file.name;
    if (file.id === appState.activeFileId) option.selected = true;
    fileSelect.appendChild(option);
  });

  syncWorkspacePathDisplay();

  const selectedId = fileSelect.value;
  if (selectedId && selectedId !== appState.activeFileId) {
    void openDocument(selectedId);
  }
}

/**
 * 同步工作区当前文件路径展示文本。
 */
function syncWorkspacePathDisplay() {
  const label = document.getElementById("workspace-path-display");
  if (!label) return;
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  if (!file) {
    label.textContent = "";
    return;
  }
  label.textContent = `${buildCategoryPath(file.categoryId)} > ${file.name}`;
}

/**
 * 加载当前文件到工作区阅读器和笔记面板。
 */
async function loadActiveWorkspaceFile() {
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  const reader = document.getElementById("reader-content");
  const title = document.getElementById("doc-title");
  if (!reader) return;
  if (!file) {
    if (title) title.textContent = "未选择学习文件";
    reader.innerHTML = '<div class="note-item"><h4>暂无文件</h4><p>请先登录并上传资料，或在图书馆中选择文件。</p></div>';
    appState.totalDocPages = 1;
    appState.currentDocPage = 1;
    document.querySelector(".document-reader")?.classList.remove("is-pdf");
    syncWorkspaceBrushUi();
    syncWorkspaceTextUi();
    renderWorkspaceNotes();
    renderWorkspaceNotes();
    renderWorkspaceVocab();
    syncSaveStatus();
    syncWorkspaceCompleteButton();
    syncPageIndicator();
    syncWorkspaceZoomUi(null);
    return;
  }
  if (!appState.workspaceData[file.id]) {
    appState.workspaceData[file.id] = {
      pages: [
        {
          html: `<p><strong>${escapeHtml(file.name)}</strong></p><p>这是新文件的学习页，你可以在这里高亮、做笔记并保存。</p>`,
          highlights: [],
          marginNotes: [],
        },
      ],
      notes: [],
      vocab: [],
      pageDrawings: {},
      pageTexts: {},
      savedAt: null,
    };
  }
  const data = appState.workspaceData[file.id];
  if (file.type === "PDF" && (!Array.isArray(data.pages) || data.pages.length === 0)) {
    const blob = await getPdfBlob(file.id);
    if (blob) {
      data.pages = await extractPdfPagesFromFile(blob);
    }
    if (!Array.isArray(data.pages) || data.pages.length === 0) {
      data.pages = [
        {
          html: `<p><strong>${escapeHtml(file.name)}</strong></p><p>未找到可恢复的 PDF 页数据，请重新上传该文件。</p>`,
          highlights: [],
          marginNotes: [],
        },
      ];
    }
  }
  normalizeWorkspaceData();
  appState.currentDocPage = Math.min(Math.max(1, appState.currentDocPage), data.pages.length);
  appState.totalDocPages = data.pages.length;
  if (title) title.textContent = file.name;
  const page = data.pages[appState.currentDocPage - 1];
  await renderWorkspaceReaderPage(file, page, reader);
  renderWorkspaceNotes();
  renderWorkspaceNotes();
  renderWorkspaceVocab();
  syncSaveStatus();
  syncWorkspaceCompleteButton();
  syncPageIndicator();
  syncWorkspaceZoomUi(file);
  syncWorkspaceBrushUi();
  syncWorkspaceTextUi();
  const docReader = document.querySelector(".document-reader");
  if (docReader) docReader.classList.toggle("is-pdf", file.type === "PDF" && appState.workspaceViewMode !== "text");
}

/**
 * 渲染工作区阅读页：PDF 默认使用“原版底图 + 可选文字层”，其余文档使用富文本模式。
 * @param {{id:string,type:string,name:string}} file 当前文件。
 * @param {{html:string}} page 当前页对象。
 * @param {HTMLElement} reader 阅读区容器。
 */
async function renderWorkspaceReaderPage(file, page, reader) {
  const shouldUsePdfOriginal = file.type === "PDF" && appState.workspaceViewMode !== "text";
  if (!shouldUsePdfOriginal) {
    reader.innerHTML = `
      <div class="paper-page">
        <div class="paper-main" id="page-content">${page.html}</div>
      </div>
    `;
    return;
  }
  const renderToken = ++runtimeState.pdf.renderToken;
  const readerWidth = Math.max(420, Math.floor(reader.clientWidth || 860));
  const tempWrap = document.createElement("div");
  tempWrap.style.cssText = "position:absolute;left:-9999px;top:0;width:" + readerWidth + "px;";
  tempWrap.innerHTML = `
    <div class="paper-page pdf-paper-page">
      <div class="paper-main pdf-layer-host" id="page-content" data-pdf-view="true"></div>
    </div>
  `;
  document.body.appendChild(tempWrap);
  const host = tempWrap.querySelector("#page-content");
  const ok = host && (await renderPdfOriginalLayer(file.id, appState.currentDocPage, host, renderToken));
  if (ok && renderToken === runtimeState.pdf.renderToken) {
    const pageEl = tempWrap.querySelector(".paper-page");
    if (pageEl) {
      reader.innerHTML = "";
      reader.appendChild(pageEl);
    }
    setTimeout(() => {
      const readerContainer = document.getElementById("reader-content");
      if (readerContainer) {
        const left = Math.max(0, Math.round((readerContainer.scrollWidth - readerContainer.clientWidth) / 2));
        readerContainer.scrollLeft = left;
      }
    }, 0);
  } else {
    reader.innerHTML = `
      <div class="paper-page">
        <div class="paper-main" id="page-content" data-pdf-view="false">${page.html}</div>
      </div>
    `;
  }
  tempWrap.remove();
}

/**
 * 获取并缓存指定文件的 PDFDocument。
 * @param {string} fileId 文件 id。
 * @returns {Promise<any|null>} PDF 文档实例。
 */
async function getCachedPdfDoc(fileId) {
  if (!fileId || typeof window.pdfjsLib === "undefined") return null;
  if (runtimeState.pdf.docCache[fileId]) return runtimeState.pdf.docCache[fileId];
  const blob = await getPdfBlob(fileId);
  if (!blob) return null;
  try {
    const buffer = await blob.arrayBuffer();
    const promise = window.pdfjsLib.getDocument({ data: buffer }).promise;
    runtimeState.pdf.docCache[fileId] = promise;
    return await promise;
  } catch {
    delete runtimeState.pdf.docCache[fileId];
    return null;
  }
}

/**
 * 渲染 PDF 原版层（canvas）和可选文字层（text layer）。
 * @param {string} fileId 文件 id。
 * @param {number} pageNumber 页码（1-based）。
 * @param {HTMLElement} host 容器节点。
 * @param {number} renderToken 渲染令牌，避免异步串页。
 * @returns {Promise<boolean>} 是否渲染成功。
 */
async function renderPdfOriginalLayer(fileId, pageNumber, host, renderToken) {
  const doc = await getCachedPdfDoc(fileId);
  if (!doc || !host) return false;
  if (renderToken !== runtimeState.pdf.renderToken) return false;
  try {
    const safePage = Math.min(Math.max(1, Number(pageNumber || 1)), Number(doc.numPages || 1));
    const page = await doc.getPage(safePage);
    const baseViewport = page.getViewport({ scale: 1 });
    const hostWidth = Math.max(420, Math.floor(host.clientWidth || 860));
    const fitScale = hostWidth / Math.max(1, baseViewport.width);
    const zoomFactor = Math.max(0.4, Math.min(4, Number(appState.workspacePdfZoom || 100) / 100));
    const scale = fitScale * zoomFactor;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-layer-canvas";
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return false;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    if (renderToken !== runtimeState.pdf.renderToken) return false;
    const textLayer = document.createElement("div");
    textLayer.className = "pdf-text-layer";
    const textContent = await page.getTextContent();
    const items = Array.isArray(textContent?.items) ? textContent.items : [];
    items.forEach((item, index) => {
      const text = String(item.str || "");
      if (!text.trim()) return;
      const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
      const angle = Math.atan2(tx[1], tx[0]);
      const fontHeight = Math.hypot(tx[2], tx[3]);
      const div = document.createElement("span");
      div.textContent = text;
      div.dataset.token = `p${safePage}-t${index}`;
      div.dataset.rawText = text;
      div.style.left = `${tx[4]}px`;
      div.style.top = `${tx[5] - fontHeight}px`;
      div.style.fontSize = `${fontHeight}px`;
      div.style.transform = `rotate(${angle}rad)`;
      textLayer.appendChild(div);
    });
    const layerPage = document.createElement("div");
    layerPage.className = "pdf-layer-page";
    layerPage.style.width = `${canvas.width}px`;
    layerPage.style.height = `${canvas.height}px`;
    layerPage.appendChild(canvas);
    layerPage.appendChild(textLayer);
    const textAnnLayer = document.createElement("div");
    textAnnLayer.className = "pdf-text-annotations";
    layerPage.appendChild(textAnnLayer);
    const drawCanvas = document.createElement("canvas");
    drawCanvas.className = "pdf-draw-layer";
    drawCanvas.width = canvas.width;
    drawCanvas.height = canvas.height;
    drawCanvas.style.width = `${canvas.width}px`;
    drawCanvas.style.height = `${canvas.height}px`;
    layerPage.appendChild(drawCanvas);
    host.innerHTML = "";
    host.appendChild(layerPage);
    host.dataset.pdfView = "true";
    const activePage = getActiveWorkspacePage();
    if (activePage) {
      applyPdfHighlightsToLayer(textLayer, activePage.highlights || []);
    }
    setupPdfPageTextAnnotations(textAnnLayer, layerPage, fileId, safePage, canvas.width, canvas.height);
    setupPdfDrawLayer(drawCanvas, fileId, safePage);
    return true;
  } catch {
    return false;
  }
}

const PDF_DRAW_WIDTH = 2;

const WORKSPACE_BRUSH_COLORS = [
  "#1a1a2e",
  "#e94560",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
];

function toggleWorkspaceText() {
  runtimeState.ui.workspaceTextMode = !runtimeState.ui.workspaceTextMode;
  if (runtimeState.ui.workspaceTextMode) {
    runtimeState.ui.workspaceBrushOn = false;
    syncWorkspaceBrushUi();
  }
  syncWorkspaceTextUi();
}

function toggleWorkspaceBrush() {
  runtimeState.ui.workspaceBrushOn = !runtimeState.ui.workspaceBrushOn;
  if (runtimeState.ui.workspaceBrushOn) {
    runtimeState.ui.workspaceTextMode = false;
    syncWorkspaceTextUi();
  }
  syncWorkspaceBrushUi();
}

function syncWorkspaceTextUi() {
  const btn = document.getElementById("workspace-text-btn");
  if (btn) btn.classList.toggle("active", runtimeState.ui.workspaceTextMode);
  document.querySelector(".document-reader")?.classList.toggle("text-mode-on", runtimeState.ui.workspaceTextMode);
}

function setWorkspaceBrushMode(mode) {
  if (mode !== "free" && mode !== "rect") return;
  appState.workspaceBrushMode = mode;
  persistLocalState();
  syncWorkspaceBrushUi();
}

function setWorkspaceBrushColor(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(hex)) return;
  appState.workspaceBrushColor = hex;
  persistLocalState();
  syncWorkspaceBrushUi();
}

function syncWorkspaceBrushUi() {
  const btn = document.getElementById("workspace-brush-btn");
  const options = document.getElementById("workspace-brush-options");
  if (btn) btn.classList.toggle("active", runtimeState.ui.workspaceBrushOn);
  if (options) {
    options.classList.toggle("on", runtimeState.ui.workspaceBrushOn);
    options.setAttribute("aria-hidden", runtimeState.ui.workspaceBrushOn ? "false" : "true");
  }
  document.querySelector(".document-reader")?.classList.toggle("brush-on", runtimeState.ui.workspaceBrushOn);
  document.querySelectorAll(".brush-mode-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === appState.workspaceBrushMode);
  });
  const colorContainer = document.getElementById("workspace-brush-colors");
  if (colorContainer) {
    colorContainer.innerHTML = "";
    WORKSPACE_BRUSH_COLORS.forEach((hex) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "brush-color-chip" + (appState.workspaceBrushColor === hex ? " active" : "");
      chip.style.backgroundColor = hex;
      chip.title = hex;
      chip.addEventListener("click", () => setWorkspaceBrushColor(hex));
      colorContainer.appendChild(chip);
    });
  }
}

/**
 * 在 PDF 原图页上挂载画笔层：绘制、持久化并同步到云端。
 * @param {HTMLCanvasElement} drawCanvas 绘制用 canvas，尺寸已与 PDF 页一致。
 * @param {string} fileId 当前文件 id。
 * @param {number} pageNumber 当前页码（1-based）。
 */
/**
 * 在 PDF 页上挂载“写文本”层：展示、添加、编辑、删除页面上的文本块，并持久化。
 */
function setupPdfPageTextAnnotations(textAnnLayer, layerPage, fileId, pageNumber, pageWidth, pageHeight) {
  if (!textAnnLayer || !fileId) return;
  const pageIndex = String(Math.max(0, pageNumber - 1));
  const data = appState.workspaceData[fileId];
  if (!data) return;
  if (!data.pageTexts || typeof data.pageTexts !== "object") data.pageTexts = {};
  if (!Array.isArray(data.pageTexts[pageIndex])) data.pageTexts[pageIndex] = [];

  function renderBlocks() {
    textAnnLayer.innerHTML = "";
    const blocks = data.pageTexts[pageIndex] || [];
    blocks.forEach((block) => {
      const el = document.createElement("div");
      el.className = "pdf-text-block";
      el.dataset.id = block.id;
      el.style.left = (Number(block.x) * 100) + "%";
      el.style.top = (Number(block.y) * 100) + "%";
      const text = String(block.text || "").trim() || "（无内容）";
      el.innerHTML = `
        <div class="pdf-text-block-content">${escapeHtml(text)}</div>
        <div class="pdf-text-block-actions">
          <button type="button" class="pdf-text-block-edit" title="编辑">✎</button>
          <button type="button" class="pdf-text-block-del" title="删除">×</button>
        </div>
      `;
      const contentEl = el.querySelector(".pdf-text-block-content");
      const editBtn = el.querySelector(".pdf-text-block-edit");
      const delBtn = el.querySelector(".pdf-text-block-del");
      editBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        startEditPdfTextBlock(el, block);
      });
      delBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const arr = data.pageTexts[pageIndex];
        const i = arr.findIndex((b) => b.id === block.id);
        if (i >= 0) { arr.splice(i, 1); persistLocalState(); renderBlocks(); }
      });
      textAnnLayer.appendChild(el);
    });
  }

  function startEditPdfTextBlock(containerEl, block) {
    const text = String(block.text || "").trim();
    containerEl.innerHTML = `
      <textarea class="pdf-text-block-input" rows="3">${escapeHtml(text)}</textarea>
      <div class="pdf-text-block-form-actions">
        <button type="button" class="btn-primary pdf-text-block-save">保存</button>
        <button type="button" class="btn-secondary pdf-text-block-cancel">取消</button>
      </div>
    `;
    const textarea = containerEl.querySelector(".pdf-text-block-input");
    const saveBtn = containerEl.querySelector(".pdf-text-block-save");
    const cancelBtn = containerEl.querySelector(".pdf-text-block-cancel");
    saveBtn?.addEventListener("click", () => {
      const next = String(textarea?.value || "").trim();
      block.text = next;
      persistLocalState();
      renderBlocks();
    });
    cancelBtn?.addEventListener("click", () => renderBlocks());
    textarea?.focus();
  }

  function addNewBlockAt(normX, normY) {
    const id = "text-" + Date.now();
    const block = { id, x: normX, y: normY, text: "" };
    data.pageTexts[pageIndex].push(block);
    persistLocalState();
    renderBlocks();
    const el = textAnnLayer.querySelector(`[data-id="${id}"]`);
    if (el) startEditPdfTextBlock(el, block);
  }

  renderBlocks();

  textAnnLayer.addEventListener("click", (e) => {
    if (!runtimeState.ui.workspaceTextMode) return;
    if (e.target.closest(".pdf-text-block")) return;
    const rect = layerPage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width || 1);
    const y = (e.clientY - rect.top) / (rect.height || 1);
    const normX = Math.max(0, Math.min(1, x));
    const normY = Math.max(0, Math.min(1, y));
    addNewBlockAt(normX, normY);
  });
}

function setupPdfDrawLayer(drawCanvas, fileId, pageNumber) {
  if (!drawCanvas || !fileId) return;
  const ctx = drawCanvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  const pageIndex = String(Math.max(0, pageNumber - 1));
  const data = appState.workspaceData[fileId];
  if (!data) return;
  if (!data.pageDrawings || typeof data.pageDrawings !== "object") data.pageDrawings = {};
  if (!Array.isArray(data.pageDrawings[pageIndex])) data.pageDrawings[pageIndex] = [];

  function getBrushColor() {
    return typeof appState.workspaceBrushColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(appState.workspaceBrushColor)
      ? appState.workspaceBrushColor
      : "#1a1a2e";
  }
  function getBrushMode() {
    return appState.workspaceBrushMode === "rect" ? "rect" : "free";
  }

  function redrawStrokes() {
    const w = drawCanvas.width;
    const h = drawCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const strokes = data.pageDrawings[pageIndex] || [];
    strokes.forEach((stroke) => {
      const color = typeof stroke.color === "string" ? stroke.color : "#1a1a2e";
      const width = typeof stroke.width === "number" ? stroke.width : PDF_DRAW_WIDTH;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (stroke.type === "rect") {
        const pts = Array.isArray(stroke.points) ? stroke.points : [];
        if (pts.length >= 2) {
          const x1 = Math.min(pts[0].x, pts[1].x) * w;
          const y1 = Math.min(pts[0].y, pts[1].y) * h;
          const x2 = Math.max(pts[0].x, pts[1].x) * w;
          const y2 = Math.max(pts[0].y, pts[1].y) * h;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        }
        return;
      }
      const points = Array.isArray(stroke.points) ? stroke.points : [];
      if (points.length < 2) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].x * w, points[0].y * h);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * w, points[i].y * h);
      }
      ctx.stroke();
    });
  }

  redrawStrokes();

  function getCoords(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / (rect.width || 1);
    const scaleY = drawCanvas.height / (rect.height || 1);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return { x: x / drawCanvas.width, y: y / drawCanvas.height };
  }

  let currentStroke = null;
  let rectEnd = null;

  function startStroke(e) {
    if (!runtimeState.ui.workspaceBrushOn) return;
    e.preventDefault();
    drawCanvas.setPointerCapture(e.pointerId);
    const { x, y } = getCoords(e);
    const color = getBrushColor();
    const mode = getBrushMode();
    if (mode === "rect") {
      currentStroke = { type: "rect", points: [{ x, y }], color, width: PDF_DRAW_WIDTH };
      rectEnd = { x, y };
    } else {
      currentStroke = { points: [{ x, y }], color, width: PDF_DRAW_WIDTH };
    }
  }

  function moveStroke(e) {
    if (!currentStroke) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    const w = drawCanvas.width;
    const h = drawCanvas.height;
    if (currentStroke.type === "rect") {
      rectEnd = { x, y };
      redrawStrokes();
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      const p0 = currentStroke.points[0];
      const x1 = Math.min(p0.x, rectEnd.x) * w;
      const y1 = Math.min(p0.y, rectEnd.y) * h;
      const x2 = Math.max(p0.x, rectEnd.x) * w;
      const y2 = Math.max(p0.y, rectEnd.y) * h;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      return;
    }
    currentStroke.points.push({ x, y });
    ctx.strokeStyle = currentStroke.color;
    ctx.lineWidth = currentStroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const pts = currentStroke.points;
    ctx.moveTo(pts[pts.length - 2].x * w, pts[pts.length - 2].y * h);
    ctx.lineTo(pts[pts.length - 1].x * w, pts[pts.length - 1].y * h);
    ctx.stroke();
  }

  function endStroke(e) {
    e.preventDefault();
    try { drawCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!currentStroke) return;
    if (currentStroke.type === "rect") {
      if (rectEnd) currentStroke.points.push(rectEnd);
      rectEnd = null;
      if (currentStroke.points.length >= 2) {
        data.pageDrawings[pageIndex].push(currentStroke);
        persistLocalState();
      }
    } else if (currentStroke.points.length >= 2) {
      data.pageDrawings[pageIndex].push(currentStroke);
      persistLocalState();
    }
    currentStroke = null;
  }

  drawCanvas.addEventListener("pointerdown", startStroke);
  drawCanvas.addEventListener("pointermove", moveStroke);
  drawCanvas.addEventListener("pointerup", endStroke);
  drawCanvas.addEventListener("pointerleave", endStroke);
  drawCanvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
}

function applyPdfHighlightsToLayer(textLayer, highlights) {
  if (!textLayer) return;
  textLayer.querySelectorAll("span").forEach((span) => {
    span.classList.remove("text-highlight");
    span.style.backgroundColor = "";
    span.textContent = String(span.dataset.rawText || span.textContent || "");
  });
  if (!Array.isArray(highlights) || highlights.length === 0) return;
  const tokenMap = new Map();
  highlights.forEach((item) => {
    const color = HIGHLIGHT_COLORS[item?.color] ? item.color : "yellow";
    const style = HIGHLIGHT_STYLES[item?.style] ? item.style : "fill";
    const segments = Array.isArray(item?.spanSegments) ? item.spanSegments : [];
    if (segments.length > 0) {
      segments.forEach((seg) => {
        const token = String(seg?.token || "");
        if (!token) return;
        const list = tokenMap.get(token) || [];
        list.push({
          start: Math.max(0, Number(seg?.start || 0)),
          end: Math.max(0, Number(seg?.end || 0)),
          color,
          style,
        });
        tokenMap.set(token, list);
      });
      return;
    }
    const tokens = Array.isArray(item?.spanTokens) ? item.spanTokens : [];
    tokens.forEach((token) => {
      const key = String(token || "");
      if (!key) return;
      const list = tokenMap.get(key) || [];
      list.push({ start: 0, end: Number.MAX_SAFE_INTEGER, color, style });
      tokenMap.set(key, list);
    });
  });
  tokenMap.forEach((ranges, token) => {
    const span = textLayer.querySelector(`span[data-token="${token}"]`);
    if (!span) return;
    paintPdfSpanRanges(span, ranges);
  });
}

function paintPdfSpanRanges(span, ranges) {
  const raw = String(span.dataset.rawText || "");
  if (!raw) return;
  const normalized = (Array.isArray(ranges) ? ranges : [])
    .map((item) => ({
      start: Math.max(0, Math.min(raw.length, Number(item.start || 0))),
      end: Math.max(0, Math.min(raw.length, Number(item.end || 0))),
      color: HIGHLIGHT_COLORS[item.color] ? item.color : "yellow",
      style: HIGHLIGHT_STYLES[item.style] ? item.style : "fill",
    }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (normalized.length === 0) {
    span.textContent = raw;
    return;
  }
  span.innerHTML = "";
  let cursor = 0;
  normalized.forEach((item) => {
    if (item.start > cursor) {
      span.appendChild(document.createTextNode(raw.slice(cursor, item.start)));
    }
    const mark = document.createElement("span");
    mark.className = `text-highlight ${item.style === "underline" ? "highlight-underline" : "highlight-fill"}`;
    mark.style.setProperty("--hl-color", HIGHLIGHT_COLORS[item.color].rgba);
    if (item.style === "underline") {
      mark.style.borderBottomColor = HIGHLIGHT_COLORS[item.color].rgba;
    }
    mark.textContent = raw.slice(item.start, item.end);
    span.appendChild(mark);
    cursor = Math.max(cursor, item.end);
  });
  if (cursor < raw.length) {
    span.appendChild(document.createTextNode(raw.slice(cursor)));
  }
}

/**
 * 渲染页边词注列表。
 * @param {Array<{term:string,meaning:string}>} marginNotes 词注数组。
 * @returns {string} HTML 字符串。
 */
function renderMarginNotes(marginNotes) {
  if (!Array.isArray(marginNotes) || marginNotes.length === 0) {
    return '<p class="margin-empty">暂无词注</p>';
  }
  return marginNotes
    .map((item) => `<div class="margin-note-item"><span class="term">${escapeHtml(item.term)}</span><span class="meaning">${escapeHtml(item.meaning)}</span></div>`)
    .join("");
}

/**
 * 根据选中文本在阅读区执行高亮标记。
 */
function applyHighlightFromSelection() {
  const pageContent = document.getElementById("page-content");
  if (!pageContent) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    showAppAlert("请先选中要高亮的文本。");
    return;
  }
  const range = selection.getRangeAt(0);
  if (!pageContent.contains(range.commonAncestorContainer)) {
    showAppAlert("请在阅读区内选择文本。");
    return;
  }
  if (range.collapsed) {
    showAppAlert("请先选中要高亮的文本。");
    return;
  }
  const selectedText = selection.toString().trim();
  const color = HIGHLIGHT_COLORS[appState.highlightColor] ? appState.highlightColor : "yellow";
  const style = HIGHLIGHT_STYLES[appState.highlightStyle] ? appState.highlightStyle : "fill";
  if (pageContent.dataset.pdfView === "true") {
    const segments = getPdfSelectionSegments(range, pageContent);
    if (segments.length === 0) {
      showAppAlert("当前选区未命中可高亮文本，请重新选择。");
      return;
    }
    registerHighlight(selectedText, { color, style, spanSegments: segments });
    const page = getActiveWorkspacePage();
    const textLayer = pageContent.querySelector(".pdf-text-layer");
    if (page && textLayer) {
      applyPdfHighlightsToLayer(textLayer, page.highlights || []);
    }
    selection.removeAllRanges();
    saveWorkspaceProgress(false);
    return;
  }
  const span = document.createElement("span");
  span.className = `text-highlight ${style === "underline" ? "highlight-underline" : "highlight-fill"}`;
  span.style.setProperty("--hl-color", HIGHLIGHT_COLORS[color].rgba);
  if (style === "underline") {
    span.style.borderBottomColor = HIGHLIGHT_COLORS[color].rgba;
  }
  try {
    range.surroundContents(span);
    registerHighlight(selectedText, { color, style });
    selection.removeAllRanges();
    saveWorkspaceProgress(false);
  } catch {
    showAppAlert("当前选区跨越了复杂节点，暂无法直接高亮，请缩小选区后重试。");
  }
}

/**
 * 记录当前页高亮文本，便于右侧查看学习痕迹。
 * @param {string} text 高亮文本。
 * @param {{color?:string,style?:string,spanTokens?:string[],spanSegments?:Array<{token:string,start:number,end:number}>}} options 额外信息。
 */
function registerHighlight(text, options = {}) {
  if (!text) return;
  const page = getActiveWorkspacePage();
  if (!page) return;
  if (!Array.isArray(page.highlights)) page.highlights = [];
  const color = HIGHLIGHT_COLORS[options.color] ? options.color : "yellow";
  const style = HIGHLIGHT_STYLES[options.style] ? options.style : "fill";
  const spanTokens = Array.isArray(options.spanTokens) ? options.spanTokens : [];
  const spanSegments = Array.isArray(options.spanSegments) ? options.spanSegments : [];
  page.highlights.push({
    id: `hl-${Date.now()}`,
    text,
    color,
    style,
    spanTokens,
    spanSegments,
    meaning: "",
    createdAt: new Date().toISOString().split("T")[0],
  });
  renderWorkspaceNotes();
}

function getPdfSelectionSegments(range, pageContent) {
  if (!range || !pageContent) return [];
  const textLayer = pageContent.querySelector(".pdf-text-layer");
  if (!textLayer) return [];
  const spans = Array.from(textLayer.querySelectorAll("span[data-token]"));
  if (spans.length === 0) return [];
  const tokenIndex = new Map();
  spans.forEach((span, idx) => tokenIndex.set(String(span.dataset.token || ""), idx));
  const start = resolvePdfSelectionPoint(range.startContainer, range.startOffset, spans, tokenIndex);
  const end = resolvePdfSelectionPoint(range.endContainer, range.endOffset, spans, tokenIndex);
  if (!start || !end) return [];
  let first = start;
  let last = end;
  if (first.index > last.index || (first.index === last.index && first.offset > last.offset)) {
    first = end;
    last = start;
  }
  const segments = [];
  for (let i = first.index; i <= last.index; i += 1) {
    const span = spans[i];
    const token = String(span.dataset.token || "");
    const raw = String(span.dataset.rawText || span.textContent || "");
    if (!token || !raw) continue;
    const startOffset = i === first.index ? first.offset : 0;
    const endOffset = i === last.index ? last.offset : raw.length;
    if (endOffset <= startOffset) continue;
    segments.push({
      token,
      start: startOffset,
      end: endOffset,
    });
  }
  return segments;
}

function resolvePdfSelectionPoint(container, offset, spans, tokenIndex) {
  const span = findTokenSpan(container);
  if (span && tokenIndex.has(String(span.dataset.token || ""))) {
    const raw = String(span.dataset.rawText || span.textContent || "");
    const charOffset = normalizeSelectionOffsetInSpan(container, offset, span, raw.length);
    return {
      index: tokenIndex.get(String(span.dataset.token || "")),
      offset: charOffset,
    };
  }
  for (let i = 0; i < spans.length; i += 1) {
    try {
      if (spans[i].contains(container)) {
        const raw = String(spans[i].dataset.rawText || spans[i].textContent || "");
        return { index: i, offset: Math.max(0, Math.min(raw.length, Number(offset || 0))) };
      }
    } catch {
    }
  }
  return null;
}

function findTokenSpan(node) {
  let cursor = node;
  while (cursor && cursor !== document) {
    if (cursor instanceof HTMLElement && cursor.dataset && cursor.dataset.token) return cursor;
    cursor = cursor.parentNode;
  }
  return null;
}

function normalizeSelectionOffsetInSpan(container, offset, span, length) {
  if (container instanceof Text) {
    return Math.max(0, Math.min(length, Number(offset || 0)));
  }
  if (container === span) {
    return Math.max(0, Math.min(length, Number(offset || 0)));
  }
  return Math.max(0, Math.min(length, Number(offset || 0)));
}

/**
 * 将选中文本快速加入笔记。
 */
function captureSelectionAsNote() {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  if (!text) {
    showAppAlert("请先选中要记录的内容。");
    return;
  }
  addNoteToActiveFile(text, "selection");
  if (selection) selection.removeAllRanges();
}

/**
 * 手动输入笔记并添加到当前文件。
 */
function addManualNote() {
  const value = getValue("note-input");
  if (!value) {
    showAppAlert("请先输入笔记内容。");
    return;
  }
  addNoteToActiveFile(value, "manual");
  setValue("note-input", "");
}

/**
 * 向当前文件添加笔记并刷新展示。
 * @param {string} text 笔记文本。
 * @param {"manual"|"selection"} source 来源类型。
 */
function addNoteToActiveFile(text, source) {
  const fileId = appState.activeFileId;
  if (!fileId) return;
  if (!appState.workspaceData[fileId]) {
    appState.workspaceData[fileId] = {
      pages: [{ html: "<p>暂无内容</p>", highlights: [], marginNotes: [] }],
      notes: [],
      vocab: [],
      savedAt: null,
    };
  }
  appState.workspaceData[fileId].notes.push({
    id: `note-${Date.now()}`,
    text,
    meaning: "",
    source,
    createdAt: new Date().toISOString().split("T")[0],
  });
  appState.notesPage = 1;
  appState.selectedNoteIds = [];
  renderWorkspaceNotes();
  saveWorkspaceProgress(false);
}

/**
 * 获取统一条目的时间戳（高亮或笔记），用于排序。
 */
function getUnifiedTimestamp(entry) {
  if (entry.type === "highlight") {
    const createdAt = String(entry.createdAt || "").trim();
    if (createdAt) {
      const t = new Date(createdAt).getTime();
      if (!Number.isNaN(t)) return t;
    }
    const match = String(entry.id || "").match(/hl-(\d+)/);
    if (match) return Number(match[1]);
    return 0;
  }
  return getNoteTimestamp(entry);
}

/**
 * 渲染当前文件的笔记列表（高亮与手动笔记合并为一条列表）。
 */
function renderWorkspaceNotes() {
  const list = document.getElementById("notes-list");
  if (!list) return;
  list.innerHTML = "";
  const fileId = appState.activeFileId;
  const page = getActiveWorkspacePage();
  const highlights = (page?.highlights || []).map((h) => ({ type: "highlight", ...h, meaning: h.meaning || "" }));
  const rawNotes = appState.workspaceData[fileId]?.notes || [];
  const notes = rawNotes.map((n) => ({ type: "note", ...n, meaning: n.meaning || "" }));
  const merged = [...highlights, ...notes];
  if (merged.length === 0) {
    updateNotesPaginationUI(1, 1, 0);
    syncNotesToolbarUi(0);
    list.innerHTML = '<div class="note-item"><h4>暂无笔记</h4><p>选中文本后点击「高亮并做笔记」，或下方手动添加笔记。</p></div>';
    return;
  }
  const query = String(appState.notesSearchQuery || "").trim().toLowerCase();
  const filtered = merged.filter((entry) => {
    if (!query) return true;
    const text = String(entry?.text || "").toLowerCase();
    const meaning = String(entry?.meaning || "").toLowerCase();
    return text.includes(query) || meaning.includes(query);
  });
  const sort = appState.notesSort === "oldest" ? "oldest" : "newest";
  filtered.sort((a, b) => {
    const diff = getUnifiedTimestamp(b) - getUnifiedTimestamp(a);
    return sort === "newest" ? diff : -diff;
  });
  const pageSize = sanitizeCount(String(appState.notesPageSize || 10), 6, 16);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, appState.notesPage || 1), totalPages);
  appState.notesPage = currentPage;
  appState.notesPageSize = pageSize;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paged = filtered.slice(startIndex, endIndex);
  updateNotesPaginationUI(currentPage, totalPages, filtered.length);
  syncNotesToolbarUi(filtered.length);
  if (paged.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>无匹配结果</h4><p>尝试调整搜索关键词。</p></div>';
    return;
  }
  paged.forEach((entry) => {
    const item = createUnifiedNoteItem(entry);
    list.appendChild(item);
  });
}

/**
 * 创建一条合并列表项（高亮或手动笔记），可编辑释义/内容、删除。
 */
function createUnifiedNoteItem(entry) {
  const item = document.createElement("div");
  item.className = "note-item";
  const createdAt = escapeHtml(entry.createdAt || "");
  const meaningLine = entry.meaning
    ? `<p class="note-meta note-body">释义：${escapeHtml(entry.meaning)}</p>`
    : "";

  if (entry.type === "highlight") {
    const color = HIGHLIGHT_COLORS[entry.color] ? entry.color : "yellow";
    const style = HIGHLIGHT_STYLES[entry.style] ? entry.style : "fill";
    item.innerHTML = `<div class="note-title-row"><div class="note-actions"><span class="priority-badge" style="background:${HIGHLIGHT_COLORS[color].rgba};color:#334155;border:1px solid rgba(100,116,139,0.2)">高亮</span><button class="btn-secondary btn-small">编辑</button><button class="note-delete-btn todo-action-btn todo-delete-btn">删除</button></div><span class="note-meta">${createdAt}</span></div><p class="note-body">${escapeHtml(entry.text)}</p>${meaningLine}`;
    const editBtn = item.querySelector(".btn-secondary");
    const delBtn = item.querySelector(".note-delete-btn");
    editBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      startEditWorkspaceHighlight(item, entry);
    });
    delBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHighlightById(entry.id);
    });
    return item;
  }

  if (appState.notesSelectionEnabled) {
    const checked = appState.selectedNoteIds.includes(entry.id) ? "checked" : "";
    item.innerHTML = `<div class="note-title-row"><div class="note-actions"><input type="checkbox" class="file-select" ${checked}></div><span class="note-meta">${createdAt}</span></div><p class="note-body">${escapeHtml(entry.text)}</p>${meaningLine}`;
    const checkbox = item.querySelector("input[type=\"checkbox\"]");
    checkbox?.addEventListener("click", (e) => { e.stopPropagation(); toggleSelectNote(entry.id); });
    item.addEventListener("click", () => toggleSelectNote(entry.id));
    return item;
  }
  item.innerHTML = `<div class="note-title-row"><div class="note-actions"><span class="priority-badge note-badge">笔记</span><button class="btn-secondary btn-small">编辑</button><button class="note-delete-btn todo-action-btn todo-delete-btn">删除</button></div><span class="note-meta">${createdAt}</span></div><p class="note-body">${escapeHtml(entry.text)}</p>${meaningLine}`;
  const editBtn = item.querySelector(".btn-secondary");
  const delBtn = item.querySelector(".note-delete-btn");
  editBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    startEditWorkspaceNote(item, entry);
  });
  delBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteNoteById(entry.id);
  });
  return item;
}

/**
 * 编辑高亮条目的笔记内容与释义。
 */
function startEditWorkspaceHighlight(container, highlight) {
  const page = getActiveWorkspacePage();
  if (!page || !highlight) return;
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "note-edit-area";
  const textLabel = document.createElement("label");
  textLabel.className = "note-edit-label";
  textLabel.textContent = "笔记内容";
  const textArea = document.createElement("textarea");
  textArea.className = "setting-input";
  textArea.rows = 3;
  textArea.placeholder = "高亮对应的笔记内容";
  textArea.value = String(highlight.text || "");
  const meaningLabel = document.createElement("label");
  meaningLabel.className = "note-edit-label";
  meaningLabel.textContent = "释义（可选）";
  const meaningInput = document.createElement("input");
  meaningInput.type = "text";
  meaningInput.className = "setting-input";
  meaningInput.placeholder = "添加释义";
  meaningInput.value = String(highlight.meaning || "");
  const actions = document.createElement("div");
  actions.className = "note-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "保存";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-secondary";
  cancelBtn.textContent = "取消";
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  wrap.appendChild(textLabel);
  wrap.appendChild(textArea);
  wrap.appendChild(meaningLabel);
  wrap.appendChild(meaningInput);
  wrap.appendChild(actions);
  container.appendChild(wrap);
  saveBtn.addEventListener("click", () => {
    const nextText = String(textArea.value || "").trim();
    const nextMeaning = String(meaningInput.value || "").trim();
    if (!nextText) {
      showAppAlert("请输入笔记内容。");
      return;
    }
    const h = page.highlights.find((x) => x.id === highlight.id);
    if (h) {
      h.text = nextText;
      h.meaning = nextMeaning;
    }
    renderWorkspaceNotes();
    saveWorkspaceProgress(false);
  });
  cancelBtn.addEventListener("click", () => renderWorkspaceNotes());
}

/**
 * 删除指定笔记内容。
 * @param {string} noteId 笔记 id。
 */
function deleteNoteById(noteId) {
  if (!noteId) return;
  const fileId = appState.activeFileId;
  const notes = appState.workspaceData[fileId]?.notes;
  if (!Array.isArray(notes)) return;
  appState.workspaceData[fileId].notes = notes.filter((note) => note.id !== noteId);
  appState.selectedNoteIds = appState.selectedNoteIds.filter((id) => id !== noteId);
  renderWorkspaceNotes();
  saveWorkspaceProgress(false);
}

function getNoteTimestamp(note) {
  const createdAt = String(note?.createdAt || "").trim();
  if (createdAt) {
    const t = new Date(createdAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const id = String(note?.id || "");
  const match = id.match(/note-(\d+)/);
  if (match) return Number(match[1]);
  return 0;
}

function createWorkspaceNoteItem(note) {
  const item = document.createElement("div");
  item.className = "note-item";
  const createdAt = escapeHtml(note.createdAt || "");
  const meaningLine = note.meaning ? `<p class="note-meta note-body">释义：${escapeHtml(note.meaning)}</p>` : "";
  if (appState.notesSelectionEnabled) {
    const checked = appState.selectedNoteIds.includes(note.id) ? "checked" : "";
    item.innerHTML = `<div class="note-title-row"><div class="note-actions"><input type="checkbox" class="file-select" ${checked}></div><span class="note-meta">${createdAt}</span></div><p class="note-body">${escapeHtml(note.text)}</p>${meaningLine}`;
    const checkbox = item.querySelector("input[type=\"checkbox\"]");
    checkbox?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSelectNote(note.id);
    });
    item.addEventListener("click", () => toggleSelectNote(note.id));
    return item;
  }
  item.innerHTML = `<div class="note-title-row"><div class="note-actions"><button class="btn-secondary">编辑</button><button class="note-delete-btn">删除</button></div><span class="note-meta">${createdAt}</span></div><p class="note-body">${escapeHtml(note.text)}</p>${meaningLine}`;
  const editBtn = item.querySelector(".btn-secondary");
  const delBtn = item.querySelector(".note-delete-btn");
  editBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    startEditWorkspaceNote(item, note);
  });
  delBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteNoteById(note.id);
  });
  return item;
}

function startEditWorkspaceNote(container, note) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "note-edit-area";
  const textArea = document.createElement("textarea");
  textArea.className = "setting-input";
  textArea.value = String(note.text || "");
  const meaningInput = document.createElement("input");
  meaningInput.type = "text";
  meaningInput.className = "setting-input";
  meaningInput.placeholder = "添加释义（可选）";
  meaningInput.value = String(note.meaning || "");
  const actions = document.createElement("div");
  actions.className = "note-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "保存";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-secondary";
  cancelBtn.textContent = "取消";
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  wrap.appendChild(textArea);
  wrap.appendChild(meaningInput);
  wrap.appendChild(actions);
  container.appendChild(wrap);
  saveBtn.addEventListener("click", () => {
    const nextText = String(textArea.value || "").trim();
    const nextMeaning = String(meaningInput.value || "").trim();
    if (!nextText) {
      showAppAlert("请输入笔记内容。");
      return;
    }
    const fileId = appState.activeFileId;
    const notes = appState.workspaceData[fileId]?.notes || [];
    const original = notes.find((n) => n.id === note.id);
    if (original) {
      original.text = nextText;
      original.meaning = nextMeaning;
    }
    renderWorkspaceNotes();
    saveWorkspaceProgress(false);
  });
  cancelBtn.addEventListener("click", () => {
    renderWorkspaceNotes();
  });
}

function handleNotesSearch() {
  const value = getValue("notes-search");
  appState.notesSearchQuery = value;
  appState.notesPage = 1;
  appState.selectedNoteIds = [];
  renderWorkspaceNotes();
}

function changeNotesSort() {
  const value = getValue("notes-sort");
  appState.notesSort = value === "oldest" ? "oldest" : "newest";
  appState.notesPage = 1;
  appState.selectedNoteIds = [];
  renderWorkspaceNotes();
}

function toggleNotesSelection() {
  appState.notesSelectionEnabled = !appState.notesSelectionEnabled;
  appState.selectedNoteIds = [];
  renderWorkspaceNotes();
}

function toggleSelectNote(noteId) {
  const idx = appState.selectedNoteIds.indexOf(noteId);
  if (idx >= 0) {
    appState.selectedNoteIds.splice(idx, 1);
  } else {
    appState.selectedNoteIds.push(noteId);
  }
  syncNotesToolbarUi();
  renderWorkspaceNotes();
}

function getVisibleNotesForSelection() {
  const fileId = appState.activeFileId;
  const page = getActiveWorkspacePage();
  const highlights = (page?.highlights || []).map((h) => ({ type: "highlight", ...h }));
  const rawNotes = appState.workspaceData[fileId]?.notes || [];
  const notes = rawNotes.map((n) => ({ type: "note", ...n }));
  const merged = [...highlights, ...notes];
  const query = String(appState.notesSearchQuery || "").trim().toLowerCase();
  const filtered = merged.filter((entry) => {
    if (!query) return true;
    const text = String(entry?.text || "").toLowerCase();
    const meaning = String(entry?.meaning || "").toLowerCase();
    return text.includes(query) || meaning.includes(query);
  });
  const sort = appState.notesSort === "oldest" ? "oldest" : "newest";
  filtered.sort((a, b) => {
    const diff = getUnifiedTimestamp(b) - getUnifiedTimestamp(a);
    return sort === "newest" ? diff : -diff;
  });
  const pageSize = sanitizeCount(String(appState.notesPageSize || 10), 6, 16);
  const currentPage = Math.max(1, appState.notesPage || 1);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paged = filtered.slice(startIndex, endIndex);
  return paged.filter((e) => e.type === "note");
}

function selectAllNotes() {
  if (!appState.notesSelectionEnabled) return;
  const visible = getVisibleNotesForSelection();
  appState.selectedNoteIds = visible.map((n) => n.id);
  syncNotesToolbarUi();
  renderWorkspaceNotes();
}

function clearNotesSelection() {
  appState.selectedNoteIds = [];
  syncNotesToolbarUi();
  renderWorkspaceNotes();
}

async function deleteSelectedNotes() {
  if (!appState.notesSelectionEnabled || appState.selectedNoteIds.length === 0) return;
  const ok = await showAppConfirm(`确认删除所选 ${appState.selectedNoteIds.length} 条笔记吗？`);
  if (!ok) return;
  const fileId = appState.activeFileId;
  const notes = appState.workspaceData[fileId]?.notes;
  if (!Array.isArray(notes)) return;
  const set = new Set(appState.selectedNoteIds);
  appState.workspaceData[fileId].notes = notes.filter((n) => !set.has(n.id));
  appState.selectedNoteIds = [];
  renderWorkspaceNotes();
  saveWorkspaceProgress(false);
}

function syncNotesToolbarUi(totalCount) {
  const search = document.getElementById("notes-search");
  const sort = document.getElementById("notes-sort");
  const toggleBtn = document.getElementById("notes-select-toggle");
  const allBtn = document.getElementById("notes-select-all");
  const clearBtn = document.getElementById("notes-select-clear");
  const delBtn = document.getElementById("notes-select-delete");
  const enabled = appState.notesSelectionEnabled;
  if (search && search.value !== String(appState.notesSearchQuery || "")) search.value = String(appState.notesSearchQuery || "");
  if (sort) sort.value = appState.notesSort === "oldest" ? "oldest" : "newest";
  if (toggleBtn) toggleBtn.textContent = enabled ? "退出选择" : "批量选择";
  const hasSelected = appState.selectedNoteIds.length > 0;
  if (allBtn) allBtn.disabled = !enabled || (typeof totalCount === "number" && totalCount <= 0);
  if (clearBtn) clearBtn.disabled = !enabled || !hasSelected;
  if (delBtn) delBtn.disabled = !enabled || !hasSelected;
}

function updateNotesPaginationUI(currentPage, totalPages, totalItems) {
  const wrap = document.getElementById("notes-pagination");
  const prevBtn = document.getElementById("notes-prev-btn");
  const nextBtn = document.getElementById("notes-next-btn");
  const info = document.getElementById("notes-page-info");
  const sizeSelect = document.getElementById("notes-page-size");
  if (wrap) wrap.style.display = totalItems <= 0 ? "none" : "flex";
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (info) info.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${totalItems} 条`;
  if (sizeSelect) sizeSelect.value = String(appState.notesPageSize || 10);
}

function changeNotesPage(delta) {
  const next = (appState.notesPage || 1) + delta;
  appState.notesPage = Math.max(1, next);
  renderWorkspaceNotes();
}

function changeNotesPageSize() {
  const value = getValue("notes-page-size");
  appState.notesPageSize = sanitizeCount(value, 10, 16);
  appState.notesPage = 1;
  renderWorkspaceNotes();
}

/**
 * 将阅读区选中文本作为词汇加入当前文件词汇表。
 */
function addSelectionToVocab() {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  if (!text) {
    showAppAlert("请先选中一个词汇或短语。");
    return;
  }
  const word = text.split(/\s+/)[0].trim();
  if (!word) {
    showAppAlert("选中的内容无效，请重试。");
    return;
  }
  addVocabToActiveFile(word, "", "selection");
  if (selection) selection.removeAllRanges();
}

/**
 * 手动新增词汇条目。
 */
function addCustomVocab() {
  openVocabModal("create");
}

/**
 * 打开词汇编辑弹窗（支持新增/编辑）。
 * @param {"create"|"edit"} mode 弹窗模式。
 * @param {string} vocabId 词汇 id（编辑时必填）。
 */
function openVocabModal(mode, vocabId = "") {
  const modal = document.getElementById("vocab-modal");
  const title = document.getElementById("vocab-modal-title");
  const wordInput = document.getElementById("vocab-word-input");
  const meaningInput = document.getElementById("vocab-meaning-input");
  if (!modal || !title || !wordInput || !meaningInput) return;

  runtimeState.vocabModal.mode = mode;
  runtimeState.vocabModal.editingId = "";
  wordInput.value = "";
  meaningInput.value = "";

  if (mode === "edit") {
    const fileId = appState.activeFileId;
    const vocabs = appState.workspaceData[fileId]?.vocab;
    const target = Array.isArray(vocabs) ? vocabs.find((item) => item.id === vocabId) : null;
    if (!target) {
      showAppAlert("未找到要编辑的词汇。");
      return;
    }
    runtimeState.vocabModal.editingId = vocabId;
    title.textContent = "📚 编辑词汇";
    wordInput.value = String(target.word || "");
    meaningInput.value = String(target.meaning || "");
  } else {
    title.textContent = "📚 新增词汇";
  }

  modal.classList.add("show");
}

/**
 * 提交词汇弹窗表单，支持新增或编辑词义。
 */
function submitVocabModal() {
  const mode = runtimeState.vocabModal.mode || "create";
  const vocabId = runtimeState.vocabModal.editingId || "";
  const word = getValue("vocab-word-input");
  const meaning = getValue("vocab-meaning-input");
  if (!word) {
    showAppAlert("请先输入词汇。");
    return;
  }

  if (mode === "edit") {
    const fileId = appState.activeFileId;
    const vocabs = appState.workspaceData[fileId]?.vocab;
    if (!Array.isArray(vocabs)) return;
    const target = vocabs.find((item) => item.id === vocabId);
    if (!target) {
      showAppAlert("未找到要编辑的词汇。");
      return;
    }
    const conflict = vocabs.some((item) => (
      item.id !== vocabId
      && normalizeQuestionBankText(item.word) === normalizeQuestionBankText(word)
    ));
    if (conflict) {
      showAppAlert("该词汇已存在，请使用其他词汇文本。");
      return;
    }
    target.word = word;
    target.meaning = meaning;
    renderWorkspaceVocab();
    saveWorkspaceProgress(false);
  } else {
    addVocabToActiveFile(word, meaning, "manual");
  }
  closeModal("vocab-modal");
}

/**
 * 向当前文件词汇表新增条目并去重。
 * @param {string} word 词汇文本。
 * @param {string} meaning 词义文本。
 * @param {"manual"|"selection"} source 来源类型。
 */
function addVocabToActiveFile(word, meaning, source) {
  const fileId = appState.activeFileId;
  if (!fileId) return;
  if (!appState.workspaceData[fileId]) {
    appState.workspaceData[fileId] = {
      pages: [{ html: "<p>暂无内容</p>", highlights: [], marginNotes: [] }],
      notes: [],
      vocab: [],
      savedAt: null,
    };
  }
  const data = appState.workspaceData[fileId];
  if (!Array.isArray(data.vocab)) data.vocab = [];
  const exists = data.vocab.some((item) => normalizeQuestionBankText(item.word) === normalizeQuestionBankText(word));
  if (exists) {
    showAppAlert("该词汇已存在，无需重复添加。");
    return;
  }
  data.vocab.push({
    id: `vocab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    word,
    meaning,
    source,
    createdAt: new Date().toISOString().split("T")[0],
  });
  renderWorkspaceVocab();
  saveWorkspaceProgress(false);
}

/**
 * 渲染当前文件词汇列表，并绑定编辑/删除事件。
 */
function renderWorkspaceVocab() {
  const list = document.getElementById("vocab-list");
  if (!list) return;
  const fileId = appState.activeFileId;
  const vocabs = appState.workspaceData[fileId]?.vocab || [];
  const pageSize = sanitizeCount(String(appState.vocabPageSize || 10), 6, 16);
  const totalPages = Math.max(1, Math.ceil(vocabs.length / pageSize));
  const currentPage = Math.min(Math.max(1, appState.vocabPage || 1), totalPages);
  appState.vocabPage = currentPage;
  appState.vocabPageSize = pageSize;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedVocabs = vocabs.slice(startIndex, endIndex);
  updateVocabPaginationUI(currentPage, totalPages, vocabs.length);
  if (vocabs.length === 0) {
    list.innerHTML = '<div class="vocab-item"><div class="vocab-word">暂无词汇</div><div class="vocab-meaning">选中文本后点击“添加做词汇”，或手动新增。</div></div>';
    updateStats();
    return;
  }
  list.innerHTML = "";
  pagedVocabs.forEach((item) => {
    const node = document.createElement("div");
    node.className = "vocab-item";
    node.innerHTML = `
      <div class="vocab-item-header">
        <div class="vocab-word">${escapeHtml(item.word || "")}</div>
        <div class="vocab-item-actions">
          <button class="note-delete-btn vocab-edit-btn" data-vocab-id="${escapeHtml(item.id)}">编辑</button>
          <button class="note-delete-btn vocab-delete-btn" data-vocab-id="${escapeHtml(item.id)}">删除</button>
        </div>
      </div>
      <div class="vocab-meaning">${escapeHtml(item.meaning || "（未填写词义）")}</div>
      <div class="note-meta">${escapeHtml(item.createdAt || "")}</div>
    `;
    list.appendChild(node);
  });
  list.querySelectorAll(".vocab-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vocabId = btn.dataset.vocabId || "";
      editVocabById(vocabId);
    });
  });
  list.querySelectorAll(".vocab-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vocabId = btn.dataset.vocabId || "";
      deleteVocabById(vocabId);
    });
  });
  updateStats();
}

function updateVocabPaginationUI(currentPage, totalPages, totalItems) {
  const wrap = document.getElementById("vocab-pagination");
  const prevBtn = document.getElementById("vocab-prev-btn");
  const nextBtn = document.getElementById("vocab-next-btn");
  const info = document.getElementById("vocab-page-info");
  const sizeSelect = document.getElementById("vocab-page-size");
  if (wrap) wrap.style.display = totalItems <= 0 ? "none" : "flex";
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (info) info.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${totalItems} 条`;
  if (sizeSelect) sizeSelect.value = String(appState.vocabPageSize || 10);
}

function changeVocabPage(delta) {
  const next = (appState.vocabPage || 1) + delta;
  appState.vocabPage = Math.max(1, next);
  renderWorkspaceVocab();
}

function changeVocabPageSize() {
  const value = getValue("vocab-page-size");
  appState.vocabPageSize = sanitizeCount(value, 10, 16);
  appState.vocabPage = 1;
  renderWorkspaceVocab();
}

/**
 * 编辑指定词汇的词面与词义。
 * @param {string} vocabId 词汇 id。
 */
function editVocabById(vocabId) {
  if (!vocabId) return;
  openVocabModal("edit", vocabId);
}

/**
 * 删除指定词汇条目。
 * @param {string} vocabId 词汇 id。
 */
function deleteVocabById(vocabId) {
  if (!vocabId) return;
  const fileId = appState.activeFileId;
  const vocabs = appState.workspaceData[fileId]?.vocab;
  if (!Array.isArray(vocabs)) return;
  appState.workspaceData[fileId].vocab = vocabs.filter((item) => item.id !== vocabId);
  renderWorkspaceVocab();
  saveWorkspaceProgress(false);
}

/**
 * 删除当前页指定 id 的高亮，并刷新页面高亮层与列表。
 * @param {string} highlightId 高亮 id（如 hl-xxx）。
 */
function deleteHighlightById(highlightId) {
  if (!highlightId) return;
  const page = getActiveWorkspacePage();
  if (!page || !Array.isArray(page.highlights)) return;
  const before = page.highlights.length;
  page.highlights = page.highlights.filter((h) => h.id !== highlightId);
  if (page.highlights.length === before) return;
  const textLayer = document.querySelector("#page-content .pdf-text-layer");
  if (textLayer) {
    applyPdfHighlightsToLayer(textLayer, page.highlights);
  }
  renderWorkspaceNotes();
  saveWorkspaceProgress(false);
}

window.deleteHighlightById = deleteHighlightById;

/**
 * 获取当前活动文件与页码对应的页面对象。
 * @returns {{html:string,highlights:Array<any>,marginNotes:Array<any>}|null} 页面对象。
 */
function getActiveWorkspacePage() {
  const fileId = appState.activeFileId;
  if (!fileId) return null;
  const data = appState.workspaceData[fileId];
  if (!data || !Array.isArray(data.pages) || data.pages.length === 0) return null;
  const idx = Math.min(Math.max(0, appState.currentDocPage - 1), data.pages.length - 1);
  return data.pages[idx];
}

/**
 * 同步保存状态显示文本。
 */
function syncSaveStatus() {
  const status = document.getElementById("workspace-save-status");
  if (!status) return;
  const fileId = appState.activeFileId;
  const savedAt = fileId ? appState.workspaceData[fileId]?.savedAt : null;
  status.textContent = savedAt ? `已保存：${new Date(savedAt).toLocaleString()}` : "未保存";
}

/**
 * 同步“学习完成”按钮文案与样式。
 */
function syncWorkspaceCompleteButton() {
  const btn = document.getElementById("workspace-complete-btn");
  if (!btn) return;
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  if (!file) {
    btn.textContent = "✅ 标记学习完成";
    btn.classList.remove("is-completed");
    return;
  }
  if (file.completed) {
    btn.textContent = "↩️ 取消学习完成";
    btn.classList.add("is-completed");
  } else {
    btn.textContent = "✅ 标记学习完成";
    btn.classList.remove("is-completed");
  }
}

/**
 * 切换当前文件的学习完成状态，并同步到图书馆展示。
 */
function toggleLearningComplete() {
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  if (!file) return;
  file.completed = !file.completed;
  file.completedAt = file.completed ? new Date().toISOString() : "";
  renderLibraryFiles();
  renderContinueLearning();
  syncWorkspaceCompleteButton();
  persistLocalState();
}

/**
 * 显式保存当前学习进度（阅读高亮、笔记等）。
 * @param {boolean} notify 是否提示保存成功。
 */
function saveWorkspaceProgress(notify = true) {
  const fileId = appState.activeFileId;
  const pageContent = document.getElementById("page-content");
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  if (!fileId || !pageContent) return;
  if (!appState.workspaceData[fileId]) {
    appState.workspaceData[fileId] = {
      pages: [{ html: pageContent.innerHTML, highlights: [], marginNotes: [] }],
      notes: [],
      vocab: [],
      savedAt: null,
    };
  }
  const page = getActiveWorkspacePage();
  if (page && !(file?.type === "PDF" && pageContent.dataset.pdfView === "true")) {
    page.html = pageContent.innerHTML;
  }
  syncRecentStudyToQuestionBank(fileId);
  appState.workspaceData[fileId].savedAt = new Date().toISOString();
  syncLearningRecordByFile(fileId);
  persistLocalState();
  syncSaveStatus();
  renderReviewTimeline();
  renderQuestionBankSummary();
  renderQuestionCategoryOptions();
  if (notify) showAppAlert("学习进度已保存，可下次继续学习。");
}

/**
 * 一键提炼当前文章要点并展示确认弹窗。
 */
function extractArticleToQuestionBank() {
  const fileId = appState.activeFileId;
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  const preview = document.getElementById("extract-preview");
  const select = document.getElementById("extract-target-category");
  if (!file || !preview || !select) return;

  const data = appState.workspaceData[fileId];
  const notes = Array.isArray(data?.notes) ? data.notes : [];
  const vocabs = Array.isArray(data?.vocab) ? data.vocab : [];
  if (notes.length === 0 && vocabs.length === 0) {
    showAppAlert("当前文件暂无笔记或词汇可导入。");
    return;
  }
  runtimeState.extract.selectedNoteIds = notes.map((n) => n.id);
  runtimeState.extract.selectedVocabIds = vocabs.map((v) => v.id);

  select.innerHTML = "";
  const categories = [...new Set(appState.questionBank.map((item) => item.category))];
  if (categories.length === 0) categories.push("英语每日新词");
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  const notesHtml = notes.length === 0
    ? '<div class="extract-line">暂无笔记</div>'
    : notes.map((note) => `
      <label class="extract-check-item">
        <input type="checkbox" data-kind="note" value="${escapeHtml(note.id)}" checked>
        <div class="extract-check-content">
          <div class="extract-check-title">${escapeHtml(note.createdAt || "")}</div>
          <div class="extract-check-text">${escapeHtml(note.text || "")}${note.meaning ? `\n释义：${escapeHtml(note.meaning)}` : ""}</div>
        </div>
      </label>
    `).join("");
  const vocabHtml = vocabs.length === 0
    ? '<div class="extract-line">暂无词汇</div>'
    : vocabs.map((item) => `
      <label class="extract-check-item">
        <input type="checkbox" data-kind="vocab" value="${escapeHtml(item.id)}" checked>
        <div class="extract-check-content">
          <div class="extract-check-title">${escapeHtml(item.createdAt || "")}</div>
          <div class="extract-check-text">${escapeHtml(item.word || "")}${item.meaning ? `\n释义：${escapeHtml(item.meaning)}` : ""}</div>
        </div>
      </label>
    `).join("");
  preview.innerHTML = `
    <div class="extract-section">
      <div class="extract-section-title">
        <h4>📝 笔记（${notes.length}）</h4>
        <div class="extract-mini-actions">
          <button class="page-btn" type="button" onclick="toggleExtractKind('note', true)">全选</button>
          <button class="page-btn" type="button" onclick="toggleExtractKind('note', false)">全不选</button>
        </div>
      </div>
      ${notesHtml}
    </div>
    <div class="extract-section">
      <div class="extract-section-title">
        <h4>📚 词汇（${vocabs.length}）</h4>
        <div class="extract-mini-actions">
          <button class="page-btn" type="button" onclick="toggleExtractKind('vocab', true)">全选</button>
          <button class="page-btn" type="button" onclick="toggleExtractKind('vocab', false)">全不选</button>
        </div>
      </div>
      ${vocabHtml}
    </div>
  `;
  const modal = document.getElementById("extract-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 将 HTML 字符串转为纯文本。
 * @param {string} html HTML 内容。
 * @returns {string} 纯文本。
 */
function htmlToPlainText(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent ? temp.textContent.replace(/\s+/g, " ").trim() : "";
}

/**
 * 文件上传后将原始文件直接提交给后端，由服务端完成解析与分块入库。
 * @param {File} fileObj 原始文件对象。
 */
async function uploadFileToServerIngest(fileObj) {
  if (!runtimeState.auth.token || !(fileObj instanceof File)) return;
  const formData = new FormData();
  formData.append("file", fileObj);
  const result = await requestApi("/rag/upload", {
    method: "POST",
    body: formData,
  });
  if (!result || result.ok !== true) {
    // 服务端入库失败不影响前端上传与阅读流程。
    // eslint-disable-next-line no-console
    console.warn("[ClawMind] server ingest upload failed:", fileObj.name);
  }
}

/**
 * 从 PDF 文件提取分页文本，生成工作区可编辑页结构。
 * @param {File|Blob} file PDF 文件。
 * @returns {Promise<Array<{html:string,highlights:Array<any>,marginNotes:Array<any>}>>} 页面数组。
 */
async function extractPdfPagesFromFile(file) {
  if (typeof window.pdfjsLib === "undefined") return [];
  try {
    const buffer = await file.arrayBuffer();
    const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = groupPdfTextItemsToLines(textContent.items || []);
      const paragraphs = buildReadableParagraphs(lines);
      const html = paragraphs.length > 0
        ? paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
        : `<p>第 ${pageNumber} 页暂无可提取文本。</p>`;
      const marginNotes = buildMarginNotesFromLines(lines);
      pages.push({
        html,
        highlights: [],
        marginNotes,
      });
    }
    return pages;
  } catch {
    return [];
  }
}

/**
 * 按 Y 坐标将 PDF 文本片段聚合为行文本。
 * @param {Array<{str:string,transform?:Array<number>}>} items 文本片段。
 * @returns {string[]} 行文本数组。
 */
function groupPdfTextItemsToLines(items) {
  const groups = [];
  items.forEach((item) => {
    const y = item.transform && item.transform.length > 5 ? item.transform[5] : 0;
    const x = item.transform && item.transform.length > 4 ? item.transform[4] : 0;
    const text = String(item.str || "").trim();
    if (!text) return;
    const hit = groups.find((group) => Math.abs(group.y - y) < 3);
    if (hit) {
      hit.parts.push({ x, text });
    } else {
      groups.push({ y, parts: [{ x, text }] });
    }
  });
  groups.sort((a, b) => b.y - a.y);
  return groups
    .map((group) => {
      const sortedParts = group.parts.sort((a, b) => a.x - b.x);
      return sortedParts.map((part) => part.text).join(" ").replace(/\s+/g, " ").trim();
    })
    .filter((line) => line.length > 0);
}

/**
 * 将原始行文本合并为更可读的段落，尽量贴近 PDF 阅读体验。
 * @param {string[]} lines 行文本数组。
 * @returns {string[]} 段落文本数组。
 */
function buildReadableParagraphs(lines) {
  const normalized = [];
  let titleParts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || "").trim();
    if (!raw) continue;
    const parts = raw
      .replace(/([\u4e00-\u9fff])([A-Za-z])/g, "$1\n$2")
      .replace(/([A-Za-z])([\u4e00-\u9fff])/g, "$1\n$2")
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
    if (titleParts.length === 0) {
      titleParts = parts;
    }
    normalized.push(...parts);
  }
  const paragraphs = [];
  let buffer = "";
  let bodyStarted = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const line = normalized[i].trim();
    if (!line) continue;
    const isTitleLine = titleParts.length > 0 && i < titleParts.length && line === titleParts[i];
    const isAuthorLine = /^(作者|Author)\b|作者[:：]|Author[:：]/i.test(line);
    if (isTitleLine || isAuthorLine) {
      if (buffer) {
        const content = bodyStarted ? buffer : `\u00A0\u00A0${buffer}`;
        paragraphs.push(content);
        bodyStarted = true;
        buffer = "";
      }
      paragraphs.push(line);
      continue;
    }
    if (!buffer) {
      buffer = line;
      continue;
    }
    const prevEndsHard = /[。！？.!?:：;；]$/.test(buffer);
    const currLooksNew = /^[A-Z"“‘(（]|^第\d+页/.test(line);
    if (prevEndsHard && currLooksNew) {
      const content = bodyStarted ? buffer : `\u00A0\u00A0${buffer}`;
      paragraphs.push(content);
      bodyStarted = true;
      buffer = line;
    } else {
      buffer = `${buffer} ${line}`.replace(/\s+/g, " ").trim();
    }
  }
  if (buffer) {
    const content = bodyStarted ? buffer : `\u00A0\u00A0${buffer}`;
    paragraphs.push(content);
  }
  return paragraphs;
}

/**
 * 从页面文本提取词注信息，显示在页边栏。
 * @param {string[]} lines 行文本。
 * @returns {Array<{term:string,meaning:string}>} 词注列表。
 */
function buildMarginNotesFromLines(lines) {
  const text = lines.join(" ");
  const words = text.match(/[A-Za-z]{6,}/g) || [];
  const unique = [...new Set(words.map((word) => word.toLowerCase()))].slice(0, 4);
  return unique.map((word) => ({
    term: word,
    meaning: "复习该词在上下文中的含义",
  }));
}

/**
 * 将提炼结果写入题库。
 */
function confirmExtractToQuestionBank() {
  const targetCategory = getValue("extract-target-category");
  if (!targetCategory) {
    showAppAlert("请选择要写入的题库分类。");
    return;
  }
  const preview = document.getElementById("extract-preview");
  if (!preview) return;
  const checked = Array.from(preview.querySelectorAll('input[type="checkbox"]:checked'));
  if (checked.length === 0) {
    showAppAlert("请至少选择一条笔记或词汇。");
    return;
  }
  const fileId = appState.activeFileId;
  const data = appState.workspaceData[fileId] || { notes: [], vocab: [] };
  const noteMap = new Map((data.notes || []).map((n) => [n.id, n]));
  const vocabMap = new Map((data.vocab || []).map((v) => [v.id, v]));
  checked.forEach((el) => {
    const kind = el.getAttribute("data-kind") || "";
    const id = el.getAttribute("value") || "";
    if (kind === "note") {
      const note = noteMap.get(id);
      if (!note) return;
      addQuestionBankItemWithDedupe({
        category: targetCategory,
        content: String(note.text || "").trim(),
        answer: String(note.meaning || "（来自工作区笔记）").trim(),
        source: "extract",
      });
    } else if (kind === "vocab") {
      const vocab = vocabMap.get(id);
      if (!vocab) return;
      addQuestionBankItemWithDedupe({
        category: targetCategory,
        content: String(vocab.word || "").trim(),
        answer: String(vocab.meaning || "（未填写词义）").trim(),
        source: "extract",
      });
    }
  });
  runtimeState.extract.selectedNoteIds = [];
  runtimeState.extract.selectedVocabIds = [];
  closeModal("extract-modal");
  showAppAlert("已将所选笔记与词汇添加到题库。");
}

function toggleExtractKind(kind, checked) {
  const preview = document.getElementById("extract-preview");
  if (!preview) return;
  preview.querySelectorAll(`input[type="checkbox"][data-kind="${kind}"]`).forEach((el) => {
    el.checked = Boolean(checked);
  });
}

/**
 * 从文章文本中提炼重点与好词好句。
 * @param {string} text 全文文本。
 * @param {string} fileName 文件名。
 * @returns {Array<{content:string,answer:string}>} 提炼结果。
 */
function buildExtractItems(text, fileName, noteTexts, highlightTexts) {
  const sentences = text.split(/[。！？.!?]/).map((s) => s.trim()).filter((s) => s.length > 12);
  const longSentences = [...sentences].sort((a, b) => b.length - a.length).slice(0, 3);
  const words = text.match(/[A-Za-z]{6,}/g) || [];
  const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))].slice(0, 3);

  const items = [];
  longSentences.forEach((sentence, index) => {
    items.push({
      content: `重点${index + 1}：${sentence}`,
      answer: `来源文档：《${fileName}》`,
    });
  });
  uniqueWords.forEach((word) => {
    items.push({
      content: `好词：${word}`,
      answer: `请回到原文语境复习该词的用法。`,
    });
  });
  noteTexts.slice(0, 3).forEach((noteText, index) => {
    items.push({
      content: `笔记提炼${index + 1}：${noteText}`,
      answer: `来源：你的学习笔记《${fileName}》`,
    });
  });
  highlightTexts.slice(0, 3).forEach((highlightText, index) => {
    items.push({
      content: `高亮摘录${index + 1}：${highlightText}`,
      answer: `来源：你的高亮内容《${fileName}》`,
    });
  });
  return items.slice(0, 6);
}

/**
 * 触发文档分析占位逻辑。
 * @param {string} fileId 文件 id。
 */
function analyzeDoc(fileId) {
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  if (!file) return;
  showAppAlert(`开始分析：${file.name}（演示模式）`);
}

/**
 * 删除文件并刷新视图。
 * @param {string} fileId 文件 id。
 */
async function deleteFile(fileId) {
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  if (!file) return;
  const ok = await showAppConfirm(`确认删除《${file.name}》吗？`);
  if (!ok) return;
  appState.libraryFiles = appState.libraryFiles.filter((item) => item.id !== fileId);
  delete appState.workspaceData[fileId];
  clearPdfDocCache(fileId);
  await deletePdfBlob(fileId);
  if (appState.activeFileId === fileId) appState.activeFileId = appState.libraryFiles[0]?.id || "";
  renderLibraryCategoryTree();
  renderLibraryFiles();
  renderContinueLearning();
  populateWorkspaceFileOptions();
  void loadActiveWorkspaceFile();
  persistLocalState();
  updateStats();
}

/**
 * 渲染日程任务列表。
 */
function renderTaskList() {
  const taskList = document.getElementById("task-list");
  const filterHint = document.getElementById("task-filter-hint");
  if (!taskList) return;
  taskList.innerHTML = "";
  const selectedDate = appState.selectedCalendarDate || "";
  const tasks = [...appState.scheduleTasks]
    .filter((task) => {
      if (!selectedDate) return true;
      return getTaskDateOnly(task) === selectedDate;
    })
    .sort((a, b) => getTaskStartAt(a).localeCompare(getTaskStartAt(b)));
  const pageSize = sanitizeCount(String(appState.taskPageSize || 10), 6, 16);
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const currentPage = Math.min(Math.max(1, appState.taskPage || 1), totalPages);
  appState.taskPage = currentPage;
  appState.taskPageSize = pageSize;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedTasks = tasks.slice(startIndex, endIndex);

  if (filterHint) {
    filterHint.textContent = selectedDate
      ? `当前查看：${selectedDate}（单击其他日期切换，双击快速添加）`
      : "单击日历日期可查看当天任务，双击可快速添加任务。";
  }

  if (tasks.length === 0) {
    taskList.innerHTML = '<div class="note-item"><h4>暂无任务</h4><p>当前日期暂无计划，双击日历可快速添加。</p></div>';
    updateTaskPaginationUI(1, 1, 0);
    return;
  }

  pagedTasks.forEach((task) => {
    const dateObj = new Date(getTaskStartAt(task));
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = `${dateObj.getMonth() + 1}月`;
    const priorityText = toPriorityText(task.priority);
    const dateText = `${formatDateTimeDisplay(getTaskStartAt(task))} ~ ${formatDateTimeDisplay(getTaskEndAt(task))}`;
    const item = document.createElement("div");
    item.className = "task-item";
    item.innerHTML = `<div class="task-date"><span class="day">${day}</span><span class="month">${month}</span></div><div class="task-info"><h3>📌 ${escapeHtml(task.title)}</h3><p>${escapeHtml(task.desc)}</p><p>${escapeHtml(task.goal || "学习目标待补充")}</p><p class="task-meta"><span class="plan-badge">${task.planType === "main" ? "主计划" : "每日计划"}</span><span class="priority-badge ${task.priority || "medium"}">${priorityText}</span><span class="time-badge">${escapeHtml(dateText)}</span></p></div><button class="task-status ${task.status}">${task.status === "done" ? "已完成" : "待完成"}</button>`;
    const statusBtn = item.querySelector(".task-status");
    if (statusBtn) {
      statusBtn.addEventListener("click", () => {
        task.status = task.status === "done" ? "pending" : "done";
        renderTaskList();
        renderTodayTodos();
          renderQuarterGoals();
          renderQuarterReview();
          renderGoalReminder();
        updateStats();
        persistLocalState();
      });
    }
    item.addEventListener("click", (event) => {
      if (event.target?.closest?.(".task-status")) return;
      openTaskEditModal(task);
    });
    taskList.appendChild(item);
  });
  updateTaskPaginationUI(currentPage, totalPages, tasks.length);
}

function updateTaskPaginationUI(currentPage, totalPages, totalItems) {
  const wrap = document.getElementById("task-pagination");
  const prevBtn = document.getElementById("task-prev-btn");
  const nextBtn = document.getElementById("task-next-btn");
  const info = document.getElementById("task-page-info");
  const sizeSelect = document.getElementById("task-page-size");
  if (wrap) wrap.style.display = totalItems <= 0 ? "none" : "flex";
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (info) info.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${totalItems} 项`;
  if (sizeSelect) sizeSelect.value = String(appState.taskPageSize || 10);
}

function changeTaskPage(delta) {
  const next = (appState.taskPage || 1) + delta;
  appState.taskPage = Math.max(1, next);
  renderTaskList();
}

function changeTaskPageSize() {
  const value = getValue("task-page-size");
  appState.taskPageSize = sanitizeCount(value, 10, 16);
  appState.taskPage = 1;
  renderTaskList();
}

function getCurrentQuarterPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${year}Q${quarter}`;
}

function getYearFromPeriod(period) {
  const match = String(period || "").match(/^(\d{4})Q[1-4]$/);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
}

function getQuarterPeriods(year) {
  return [1, 2, 3, 4].map((q) => `${year}Q${q}`);
}

function ensureGoalPeriod() {
  if (!appState.selectedGoalPeriod) {
    appState.selectedGoalPeriod = getCurrentQuarterPeriod();
  }
}

function changeGoalPeriod() {
  const next = getValue("goal-quarter-select");
  if (!next) return;
  appState.selectedGoalPeriod = next;
  appState.selectedQuarterGoalId = "";
  renderGoalCenter();
}

function renderGoalCenter() {
  ensureGoalPeriod();
  renderGoalReminder();
  renderYearGoals();
  renderQuarterGoals();
  renderQuarterReview();
}

function getQuarterRange(period) {
  const match = String(period || "").match(/^(\d{4})Q([1-4])$/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const quarter = match ? Number(match[2]) : Math.floor(new Date().getMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start, end };
}

function getQuarterDaysLeft(period) {
  const { end } = getQuarterRange(period);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.ceil((endDate - current) / (24 * 3600 * 1000));
  return Math.max(0, diff + 1);
}

function isDateInQuarter(dateStr, period) {
  const { start, end } = getQuarterRange(period);
  const date = new Date(`${dateStr}T00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function getTasksByTitleInQuarter(titles, period) {
  if (!titles || titles.size === 0) return [];
  return (appState.scheduleTasks || [])
    .filter((task) => titles.has(task.title))
    .filter((task) => isDateInQuarter(getTaskDateOnly(task), period));
}

function getKrTaskTitles(krId) {
  return new Set((appState.krTaskLinks || []).filter((link) => link.krId === krId).map((link) => link.title));
}

function getKrTasks(krId, period) {
  const titles = getKrTaskTitles(krId);
  return getTasksByTitleInQuarter(titles, period);
}

function getKrComputedValues(krId, period) {
  const kr = (appState.goalKrs || []).find((item) => item.id === krId);
  const base = Number(kr?.currentValue || 0);
  const tasks = getKrTasks(krId, period);
  const taskTotal = tasks.length;
  const taskDone = tasks.filter((task) => task.status === "done").length;
  const manualTarget = Number(kr?.targetValue || 0);
  const target = manualTarget > 0 ? manualTarget : taskTotal;
  const current = base + taskDone;
  return {
    target,
    current,
    taskTotal,
    taskDone,
    base: Number.isFinite(base) ? base : 0,
  };
}

function getKrTitlesByGoal(goalId) {
  const krs = (appState.goalKrs || []).filter((kr) => kr.goalId === goalId);
  const titles = new Set();
  krs.forEach((kr) => {
    getKrTaskTitles(kr.id).forEach((title) => titles.add(title));
  });
  return titles;
}

function getQuarterTasks(period) {
  const goals = (appState.quarterGoals || []).filter((goal) => goal.period === period);
  const titles = new Set();
  goals.forEach((goal) => {
    getKrTitlesByGoal(goal.id).forEach((title) => titles.add(title));
  });
  return getTasksByTitleInQuarter(titles, period);
}

function getGoalTasksInQuarter(goalId, period) {
  const titles = getKrTitlesByGoal(goalId);
  return getTasksByTitleInQuarter(titles, period);
}

function getKrAggregateByGoal(goalId) {
  const krs = (appState.goalKrs || []).filter((kr) => kr.goalId === goalId);
  const goal = (appState.quarterGoals || []).find((item) => item.id === goalId);
  const period = goal?.period || appState.selectedGoalPeriod || getCurrentQuarterPeriod();
  let targetTotal = 0;
  let currentTotal = 0;
  krs.forEach((kr) => {
    const computed = getKrComputedValues(kr.id, period);
    if (computed.target > 0) targetTotal += computed.target;
    if (computed.current > 0) currentTotal += computed.current;
  });
  return { targetTotal, currentTotal };
}

function getKrAggregateByPeriod(period) {
  const goalIds = new Set((appState.quarterGoals || []).filter((goal) => goal.period === period).map((goal) => goal.id));
  const krs = (appState.goalKrs || []).filter((kr) => goalIds.has(kr.goalId));
  let targetTotal = 0;
  let currentTotal = 0;
  krs.forEach((kr) => {
    const computed = getKrComputedValues(kr.id, period);
    if (computed.target > 0) targetTotal += computed.target;
    if (computed.current > 0) currentTotal += computed.current;
  });
  return { targetTotal, currentTotal };
}

function renderGoalReminder() {
  const periodEl = document.getElementById("goal-summary-period");
  const daysEl = document.getElementById("goal-summary-days");
  const progressEl = document.getElementById("goal-summary-progress");
  const progressBar = document.getElementById("goal-summary-progress-bar");
  const progressText = document.getElementById("goal-summary-progress-text");
  const pendingEl = document.getElementById("goal-summary-pending");
  const warningEl = document.getElementById("goal-warning");
  ensureGoalPeriod();
  const period = appState.selectedGoalPeriod;
  const { start, end } = getQuarterRange(period);
  const totalDays = Math.max(1, Math.ceil((end - start) / (24 * 3600 * 1000)) + 1);
  const daysLeft = getQuarterDaysLeft(period);
  const daysPassed = Math.max(0, totalDays - daysLeft);
  const tasks = getQuarterTasks(period);
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const pending = total - done;
  const krAgg = getKrAggregateByPeriod(period);
  const target = krAgg.targetTotal > 0 ? krAgg.targetTotal : total;
  const current = krAgg.targetTotal > 0 ? krAgg.currentTotal : done;
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const progressLabel = target > 0 ? `${progress}% (${current}/${target})` : `${progress}%`;
  if (periodEl) periodEl.textContent = `当前季度：${period}`;
  if (daysEl) daysEl.textContent = String(daysLeft);
  if (progressEl) progressEl.textContent = progressLabel;
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressText) progressText.textContent = progressLabel;
  if (pendingEl) pendingEl.textContent = String(pending);
  if (warningEl) {
    const timeProgress = Math.min(100, Math.round((daysPassed / totalDays) * 100));
    const taskProgress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const gap = timeProgress - taskProgress;
    const dailyNeed = daysLeft > 0 ? (pending / daysLeft) : pending;
    let level = "is-normal";
    let text = `当前进度平稳：时间进度 ${timeProgress}% · 任务完成 ${taskProgress}% · 剩余 ${daysLeft} 天/ ${pending} 任务`;
    if (total === 0) {
      text = "当前季度暂无任务，建议先绑定季度任务以便跟踪进度。";
      level = "is-normal";
    } else if (gap >= 20 || dailyNeed >= 3) {
      level = "is-danger";
      text = `进度紧张：时间进度 ${timeProgress}% · 任务完成 ${taskProgress}% · 剩余 ${daysLeft} 天/ ${pending} 任务（建议每天完成 ${dailyNeed.toFixed(1)} 个）`;
    } else if (gap >= 10 || dailyNeed >= 2) {
      level = "is-warn";
      text = `进度偏慢：时间进度 ${timeProgress}% · 任务完成 ${taskProgress}% · 剩余 ${daysLeft} 天/ ${pending} 任务（建议每天完成 ${dailyNeed.toFixed(1)} 个）`;
    }
    warningEl.className = `goal-warning ${level}`;
    warningEl.textContent = text;
  }
  const homePeriod = document.getElementById("goal-home-period");
  const homeYear = document.getElementById("goal-home-year");
  const homeProgress = document.getElementById("goal-home-progress");
  const homeBar = document.getElementById("goal-home-progress-bar");
  const homePending = document.getElementById("goal-home-pending");
  if (homePeriod) homePeriod.textContent = `当前季度：${period}`;
  if (homeYear) homeYear.textContent = `年度目标 ${appState.yearGoals.length} 个`;
  if (homeProgress) homeProgress.textContent = progressLabel;
  if (homeBar) homeBar.style.width = `${progress}%`;
  if (homePending) homePending.textContent = String(pending);
}

function renderYearGoals() {
  const list = document.getElementById("year-goals-list");
  if (!list) return;
  list.innerHTML = "";
  const goals = appState.yearGoals || [];
  if (goals.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>暂无年度目标</h4><p>添加 1-3 个年度方向，保持聚焦。</p></div>';
    return;
  }
  goals.forEach((goal) => {
    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <div class="goal-card-title">${escapeHtml(goal.title)}</div>
      <div class="note-meta">${escapeHtml(goal.description || "")}</div>
      <div class="goal-card-meta">
        <span class="plan-badge">${escapeHtml(goal.year)}</span>
        <span class="goal-status ${escapeHtml(goal.status || "active")}">${toGoalStatusText(goal.status)}</span>
      </div>
      <div class="goal-detail-actions">
        <button class="btn-secondary" data-action="edit">编辑</button>
        <button class="btn-danger" data-action="delete">删除</button>
      </div>
    `;
    card.querySelector('[data-action="edit"]')?.addEventListener("click", () => openYearGoalModal("edit", goal.id));
    card.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
      const ok = await showAppConfirm("确认删除该年度目标吗？");
      if (!ok) return;
      appState.yearGoals = appState.yearGoals.filter((item) => item.id !== goal.id);
      persistLocalState();
      renderYearGoals();
    });
    list.appendChild(card);
  });
}

function renderQuarterGoals() {
  const select = document.getElementById("goal-quarter-select");
  const list = document.getElementById("quarter-goal-list");
  const detail = document.getElementById("quarter-goal-detail");
  if (!select || !list || !detail) return;
  ensureGoalPeriod();
  const year = getYearFromPeriod(appState.selectedGoalPeriod);
  select.innerHTML = "";
  getQuarterPeriods(year).forEach((period) => {
    const option = document.createElement("option");
    option.value = period;
    option.textContent = period;
    select.appendChild(option);
  });
  select.value = appState.selectedGoalPeriod;
  const goals = (appState.quarterGoals || []).filter((goal) => goal.period === appState.selectedGoalPeriod);
  list.innerHTML = "";
  if (goals.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>暂无季度目标</h4><p>为当前季度添加目标，便于追踪进度。</p></div>';
    detail.innerHTML = '<div class="note-item"><h4>请选择或新增目标</h4><p>选中目标后可查看 KR 与关联任务。</p></div>';
    return;
  }
  if (!goals.some((goal) => goal.id === appState.selectedQuarterGoalId)) {
    appState.selectedQuarterGoalId = goals[0]?.id || "";
  }
  goals.forEach((goal) => {
    const { progress, doneCount, totalCount } = getGoalTaskProgress(goal.id);
    const card = document.createElement("div");
    card.className = `goal-card ${goal.id === appState.selectedQuarterGoalId ? "active" : ""}`;
    card.innerHTML = `
      <div class="goal-card-title">${escapeHtml(goal.title)}</div>
      <div class="note-meta">${escapeHtml(goal.description || "")}</div>
      <div class="goal-progress">
        <div class="goal-progress-bar"><span style="width:${getKrProgressForGoal(goal.id).progress}%"></span></div>
        <div class="goal-progress-text">${getKrProgressForGoal(goal.id).label}</div>
      </div>
      <div class="goal-card-meta">
        <span class="plan-badge">${escapeHtml(goal.period)}</span>
        <span class="goal-status ${escapeHtml(goal.status || "active")}">${toGoalStatusText(goal.status)}</span>
        <span class="note-meta">任务 ${doneCount}/${totalCount}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      appState.selectedQuarterGoalId = goal.id;
      renderQuarterGoals();
    });
    list.appendChild(card);
  });
  renderQuarterGoalDetail(appState.selectedQuarterGoalId, detail);
  renderGoalReminder();
}

function renderQuarterGoalDetail(goalId, container) {
  const goal = (appState.quarterGoals || []).find((item) => item.id === goalId);
  if (!goal) {
    container.innerHTML = '<div class="note-item"><h4>请选择或新增目标</h4><p>选中目标后可查看 KR 与关联任务。</p></div>';
    return;
  }
  const krs = (appState.goalKrs || []).filter((kr) => kr.goalId === goalId);
  const { doneCount, totalCount } = getGoalTaskProgress(goalId);
  const krProgress = getKrProgressForGoal(goalId);
  container.innerHTML = `
    <div class="goal-detail-section">
      <div class="goal-card-title">${escapeHtml(goal.title)}</div>
      <div class="note-meta">${escapeHtml(goal.description || "")}</div>
      <div class="goal-progress">
        <div class="goal-progress-bar"><span style="width:${krProgress.progress}%"></span></div>
        <div class="goal-progress-text">${krProgress.label}</div>
      </div>
      <div class="goal-card-meta">
        <span class="plan-badge">${escapeHtml(goal.period)}</span>
        <span class="goal-status ${escapeHtml(goal.status || "active")}">${toGoalStatusText(goal.status)}</span>
        <span class="note-meta">任务 ${doneCount}/${totalCount}</span>
      </div>
      <div class="goal-detail-actions">
        <button class="btn-secondary" id="goal-edit-btn">编辑目标</button>
        <button class="btn-danger" id="goal-delete-btn">删除目标</button>
        <button class="btn-primary" id="goal-add-kr-btn">新增 KR</button>
      </div>
    </div>
    <div class="goal-detail-section">
      <div class="section-head">
        <h3 class="section-title">关键结果</h3>
      </div>
      <div class="kr-list" id="kr-list"></div>
    </div>
    <div class="goal-detail-section">
      <div class="goal-task-filters">
        <span class="section-title">关联任务</span>
        <select class="setting-input" id="goal-task-filter">
          <option value="all">全部</option>
          <option value="pending">待完成</option>
          <option value="done">已完成</option>
        </select>
        <select class="setting-input" id="goal-task-sort">
          <option value="time">按时间排序</option>
          <option value="priority">按优先级排序</option>
        </select>
      </div>
      <div class="goal-task-list" id="goal-task-list"></div>
    </div>
  `;
  container.querySelector("#goal-edit-btn")?.addEventListener("click", () => openQuarterGoalModal("edit", goal.id));
  container.querySelector("#goal-delete-btn")?.addEventListener("click", async () => {
    const ok = await showAppConfirm("确认删除该季度目标吗？");
    if (!ok) return;
    appState.quarterGoals = appState.quarterGoals.filter((item) => item.id !== goal.id);
    appState.goalKrs = appState.goalKrs.filter((item) => item.goalId !== goal.id);
    appState.goalTaskLinks = appState.goalTaskLinks.filter((link) => link.goalId !== goal.id);
    appState.selectedQuarterGoalId = "";
    persistLocalState();
    renderQuarterGoals();
    renderQuarterReview();
  });
  container.querySelector("#goal-add-kr-btn")?.addEventListener("click", () => openKrModal("create", "", goal.id));
  const filterSelect = container.querySelector("#goal-task-filter");
  if (filterSelect) {
    filterSelect.value = appState.goalTaskFilter || "all";
    filterSelect.addEventListener("change", () => {
      appState.goalTaskFilter = filterSelect.value;
      renderGoalTasks(goal.id);
    });
  }
  const sortSelect = container.querySelector("#goal-task-sort");
  if (sortSelect) {
    sortSelect.value = appState.goalTaskSort || "time";
    sortSelect.addEventListener("change", () => {
      appState.goalTaskSort = sortSelect.value;
      renderGoalTasks(goal.id);
    });
  }
  renderKrList(goal.id);
  renderGoalTasks(goal.id);
}

function toGoalStatusText(status) {
  if (status === "paused") return "暂停";
  if (status === "done") return "已完成";
  return "进行中";
}

function getGoalTaskProgress(goalId) {
  const tasks = getGoalTasks(goalId);
  if (tasks.length === 0) return { progress: 0, doneCount: 0, totalCount: 0 };
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const progress = Math.round((doneCount / tasks.length) * 100);
  return { progress, doneCount, totalCount: tasks.length };
}

function getKrProgressForGoal(goalId) {
  const goal = (appState.quarterGoals || []).find((item) => item.id === goalId);
  const period = goal?.period || appState.selectedGoalPeriod || getCurrentQuarterPeriod();
  const krAgg = getKrAggregateByGoal(goalId);
  const target = krAgg.targetTotal;
  const current = krAgg.currentTotal;
  if (target <= 0) return { progress: 0, label: "0%" };
  const progress = Math.min(100, Math.round((current / target) * 100));
  return { progress, label: `${progress}% (${current}/${target})` };
}

function getGoalTasks(goalId) {
  const goal = (appState.quarterGoals || []).find((item) => item.id === goalId);
  const period = goal?.period || appState.selectedGoalPeriod || getCurrentQuarterPeriod();
  return getGoalTasksInQuarter(goalId, period);
}

function renderKrList(goalId) {
  const list = document.getElementById("kr-list");
  if (!list) return;
  list.innerHTML = "";
  const krs = (appState.goalKrs || []).filter((kr) => kr.goalId === goalId);
  if (krs.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>暂无 KR</h4><p>添加 3-5 条关键结果。</p></div>';
    return;
  }
  krs.forEach((kr) => {
    const node = document.createElement("div");
    node.className = "kr-item";
    const goal = (appState.quarterGoals || []).find((item) => item.id === goalId);
    const period = goal?.period || appState.selectedGoalPeriod || getCurrentQuarterPeriod();
    const computed = getKrComputedValues(kr.id, period);
    const hasTarget = computed.target > 0;
    const progress = hasTarget ? Math.min(100, Math.round((computed.current / computed.target) * 100)) : 0;
    const valueText = hasTarget
      ? `${String(computed.current)} / ${String(computed.target)} ${escapeHtml(kr.unit || "")}`
      : "未设定目标值";
    node.innerHTML = `
      <div class="kr-item-header">
        <div>${escapeHtml(kr.title)}</div>
        <div class="kr-actions">
          <button class="btn-secondary" data-action="bind">绑定任务</button>
          <button class="btn-secondary" data-action="edit">编辑</button>
          <button class="btn-danger" data-action="delete">删除</button>
        </div>
      </div>
      <div class="note-meta">${escapeHtml(valueText)}</div>
      <div class="note-meta">任务完成 ${computed.taskDone}/${computed.taskTotal} · 手动值 ${computed.base}</div>
      ${hasTarget ? `<div class="kr-progress"><div class="kr-progress-bar"><span style="width:${progress}%"></span></div><div class="kr-progress-text">${progress}%</div></div>` : ""}
      <div class="goal-card-meta">
        <span class="goal-status ${escapeHtml(kr.status || "active")}">${toGoalStatusText(kr.status)}</span>
      </div>
    `;
    node.querySelector('[data-action="bind"]')?.addEventListener("click", () => openKrTaskModal(kr.id));
    node.querySelector('[data-action="edit"]')?.addEventListener("click", () => openKrModal("edit", kr.id, goalId));
    node.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
      const ok = await showAppConfirm("确认删除该 KR 吗？");
      if (!ok) return;
      appState.goalKrs = appState.goalKrs.filter((item) => item.id !== kr.id);
      persistLocalState();
      renderKrList(goalId);
      renderQuarterReview();
    });
    list.appendChild(node);
  });
}

function renderGoalTasks(goalId) {
  const list = document.getElementById("goal-task-list");
  if (!list) return;
  list.innerHTML = "";
  let tasks = getGoalTasks(goalId);
  const filter = appState.goalTaskFilter || "all";
  const filtered = tasks.filter((task) => (filter === "all" ? true : task.status === filter));
  const sortMode = appState.goalTaskSort || "time";
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "priority") {
      const rankA = getPriorityRank(a.priority);
      const rankB = getPriorityRank(b.priority);
      if (rankA !== rankB) return rankB - rankA;
    }
    return getTaskStartAt(a).localeCompare(getTaskStartAt(b));
  });
  if (sorted.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>暂无关联任务</h4><p>绑定任务后进度会自动更新。</p></div>';
    return;
  }
  sorted.forEach((task) => {
    const node = document.createElement("div");
    node.className = "goal-task-item";
    const dateText = `${formatDateTimeDisplay(getTaskStartAt(task))} ~ ${formatDateTimeDisplay(getTaskEndAt(task))}`;
    const priorityText = toPriorityText(task.priority);
    node.innerHTML = `
      <div class="goal-task-header">
        <div>${escapeHtml(task.title)}</div>
        <div class="goal-task-actions">
          <button class="task-status ${task.status}">${task.status === "done" ? "已完成" : "待完成"}</button>
        </div>
      </div>
      <div class="note-meta">${escapeHtml(task.desc || "")}</div>
      <div class="goal-task-meta">
        <span class="priority-badge ${escapeHtml(task.priority || "medium")}">${priorityText}</span>
        <span class="time-badge">${escapeHtml(dateText)}</span>
      </div>
    `;
    const statusBtn = node.querySelector(".task-status");
    statusBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      task.status = task.status === "done" ? "pending" : "done";
      renderTaskList();
      renderGoalTasks(goalId);
      renderQuarterGoals();
      renderQuarterReview();
      renderGoalReminder();
      persistLocalState();
      updateStats();
    });
    node.addEventListener("click", () => openTaskEditModal(task));
    list.appendChild(node);
  });
}

function openYearGoalModal(mode, goalId = "") {
  runtimeState.goalModal.mode = mode;
  runtimeState.goalModal.type = "year";
  runtimeState.goalModal.goalId = goalId;
  const title = document.getElementById("year-goal-modal-title");
  if (title) title.textContent = mode === "edit" ? "编辑年度目标" : "新增年度目标";
  const currentYear = new Date().getFullYear();
  if (mode === "edit") {
    const goal = (appState.yearGoals || []).find((item) => item.id === goalId);
    if (!goal) return;
    setValue("year-goal-year", String(goal.year || currentYear));
    setValue("year-goal-title", goal.title || "");
    setValue("year-goal-desc", goal.description || "");
    setValue("year-goal-status", goal.status || "active");
  } else {
    setValue("year-goal-year", String(currentYear));
    setValue("year-goal-title", "");
    setValue("year-goal-desc", "");
    setValue("year-goal-status", "active");
  }
  const modal = document.getElementById("year-goal-modal");
  if (modal) modal.classList.add("show");
}

function submitYearGoalModal() {
  const year = Number(getValue("year-goal-year") || new Date().getFullYear());
  const title = getValue("year-goal-title");
  if (!title) {
    showAppAlert("请输入年度目标标题。");
    return;
  }
  const desc = getValue("year-goal-desc");
  const status = getValue("year-goal-status") || "active";
  if (runtimeState.goalModal.mode === "edit") {
    const target = (appState.yearGoals || []).find((item) => item.id === runtimeState.goalModal.goalId);
    if (!target) return;
    target.year = year;
    target.title = title;
    target.description = desc;
    target.status = status;
    target.updatedAt = new Date().toISOString();
  } else {
    appState.yearGoals.push({
      id: `year-goal-${Date.now()}`,
      year,
      title,
      description: desc,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  persistLocalState();
  renderYearGoals();
  closeModal("year-goal-modal");
}

function openQuarterGoalModal(mode, goalId = "") {
  ensureGoalPeriod();
  runtimeState.goalModal.mode = mode;
  runtimeState.goalModal.type = "quarter";
  runtimeState.goalModal.goalId = goalId;
  const title = document.getElementById("quarter-goal-modal-title");
  if (title) title.textContent = mode === "edit" ? "编辑季度目标" : "新增季度目标";
  const period = appState.selectedGoalPeriod || getCurrentQuarterPeriod();
  setText("quarter-goal-period", period);
  if (mode === "edit") {
    const goal = (appState.quarterGoals || []).find((item) => item.id === goalId);
    if (!goal) return;
    setValue("quarter-goal-title", goal.title || "");
    setValue("quarter-goal-desc", goal.description || "");
    setValue("quarter-goal-status", goal.status || "active");
  } else {
    setValue("quarter-goal-title", "");
    setValue("quarter-goal-desc", "");
    setValue("quarter-goal-status", "active");
  }
  const modal = document.getElementById("quarter-goal-modal");
  if (modal) modal.classList.add("show");
}

function submitQuarterGoalModal() {
  ensureGoalPeriod();
  const title = getValue("quarter-goal-title");
  if (!title) {
    showAppAlert("请输入季度目标标题。");
    return;
  }
  const desc = getValue("quarter-goal-desc");
  const status = getValue("quarter-goal-status") || "active";
  const period = appState.selectedGoalPeriod || getCurrentQuarterPeriod();
  if (runtimeState.goalModal.mode === "edit") {
    const target = (appState.quarterGoals || []).find((item) => item.id === runtimeState.goalModal.goalId);
    if (!target) return;
    target.title = title;
    target.description = desc;
    target.status = status;
    target.updatedAt = new Date().toISOString();
  } else {
    const id = `quarter-goal-${Date.now()}`;
    appState.quarterGoals.push({
      id,
      period,
      title,
      description: desc,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    appState.selectedQuarterGoalId = id;
  }
  persistLocalState();
  renderQuarterGoals();
  renderQuarterReview();
  closeModal("quarter-goal-modal");
}

function openKrModal(mode, krId = "", goalId = "") {
  runtimeState.krModal.mode = mode;
  runtimeState.krModal.krId = krId;
  runtimeState.krModal.goalId = goalId || appState.selectedQuarterGoalId;
  const title = document.getElementById("kr-modal-title");
  if (title) title.textContent = mode === "edit" ? "编辑 KR" : "新增 KR";
  if (mode === "edit") {
    const target = (appState.goalKrs || []).find((item) => item.id === krId);
    if (!target) return;
    setValue("kr-title", target.title || "");
    setValue("kr-target", target.targetValue != null ? String(target.targetValue) : "");
    setValue("kr-current", target.currentValue != null ? String(target.currentValue) : "");
    setValue("kr-unit", target.unit || "");
    setValue("kr-status", target.status || "active");
  } else {
    setValue("kr-title", "");
    setValue("kr-target", "");
    setValue("kr-current", "");
    setValue("kr-unit", "");
    setValue("kr-status", "active");
  }
  const modal = document.getElementById("kr-modal");
  if (modal) modal.classList.add("show");
}

function submitKrModal() {
  const goalId = runtimeState.krModal.goalId || appState.selectedQuarterGoalId;
  if (!goalId) {
    showAppAlert("请先选择季度目标。");
    return;
  }
  const title = getValue("kr-title");
  if (!title) {
    showAppAlert("请输入 KR 内容。");
    return;
  }
  const targetValue = getValue("kr-target");
  const currentValue = getValue("kr-current");
  const unit = getValue("kr-unit");
  const status = getValue("kr-status") || "active";
  if (runtimeState.krModal.mode === "edit") {
    const target = (appState.goalKrs || []).find((item) => item.id === runtimeState.krModal.krId);
    if (!target) return;
    target.title = title;
    target.targetValue = targetValue ? Number(targetValue) : null;
    target.currentValue = currentValue ? Number(currentValue) : null;
    target.unit = unit;
    target.status = status;
  } else {
    appState.goalKrs.push({
      id: `kr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      goalId,
      title,
      targetValue: targetValue ? Number(targetValue) : null,
      currentValue: currentValue ? Number(currentValue) : null,
      unit,
      status,
    });
  }
  persistLocalState();
  renderKrList(goalId);
  renderQuarterReview();
  closeModal("kr-modal");
}

function openGoalTaskModal(goalId) {
  runtimeState.goalTaskModal.goalId = goalId;
  const list = document.getElementById("goal-task-modal-list");
  if (!list) return;
  list.innerHTML = "";
  const linked = new Set((appState.goalTaskLinks || []).filter((l) => l.goalId === goalId).map((l) => l.taskId));
  const tasks = [...(appState.scheduleTasks || [])].sort((a, b) => getTaskStartAt(a).localeCompare(getTaskStartAt(b)));
  if (tasks.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>暂无任务</h4><p>请先在日程中心创建任务。</p></div>';
  } else {
    tasks.forEach((task) => {
      const option = document.createElement("label");
      option.className = "goal-task-option";
      const checked = linked.has(task.id) ? "checked" : "";
      const dateText = `${formatDateTimeDisplay(getTaskStartAt(task))} ~ ${formatDateTimeDisplay(getTaskEndAt(task))}`;
      option.innerHTML = `
        <input type="checkbox" value="${escapeHtml(task.id)}" ${checked}>
        <div>
          <div>${escapeHtml(task.title)}</div>
          <div class="note-meta">${escapeHtml(dateText)}</div>
        </div>
      `;
      list.appendChild(option);
    });
  }
  const modal = document.getElementById("goal-task-modal");
  if (modal) modal.classList.add("show");
}

function openKrTaskModal(krId) {
  runtimeState.krTaskModal.krId = krId;
  const list = document.getElementById("kr-task-modal-list");
  const titleEl = document.getElementById("kr-task-modal-title");
  if (!list) return;
  list.innerHTML = "";
  const kr = (appState.goalKrs || []).find((item) => item.id === krId);
  const goal = kr ? (appState.quarterGoals || []).find((item) => item.id === kr.goalId) : null;
  const period = goal?.period || appState.selectedGoalPeriod || getCurrentQuarterPeriod();
  if (titleEl) titleEl.textContent = kr ? `绑定 KR 任务 · ${kr.title}` : "绑定 KR 任务";
  const tasks = (appState.scheduleTasks || []).filter((task) => isDateInQuarter(getTaskDateOnly(task), period));
  if (tasks.length === 0) {
    list.innerHTML = '<div class="note-item"><h4>暂无任务</h4><p>当前季度没有可绑定的任务。</p></div>';
  } else {
    const groupMap = new Map();
    tasks.forEach((task) => {
      const title = String(task.title || "").trim();
      if (!title) return;
      if (!groupMap.has(title)) {
        groupMap.set(title, { title, tasks: [] });
      }
      groupMap.get(title).tasks.push(task);
    });
    const linked = getKrTaskTitles(krId);
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      const rankA = getPriorityRank(a.tasks[0]?.priority);
      const rankB = getPriorityRank(b.tasks[0]?.priority);
      if (rankA !== rankB) return rankB - rankA;
      return a.title.localeCompare(b.title, "zh-Hans-CN");
    });
    groups.forEach((group) => {
      const option = document.createElement("label");
      option.className = "goal-task-option";
      const checked = linked.has(group.title) ? "checked" : "";
      const dates = group.tasks.map((t) => getTaskDateOnly(t)).sort();
      const rangeText = dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : "";
      const priorityText = toPriorityText(group.tasks[0]?.priority);
      option.innerHTML = `
        <input type="checkbox" value="${escapeHtml(group.title)}" ${checked}>
        <div>
          <div>${escapeHtml(group.title)}</div>
          <div class="goal-task-meta">
            <span class="priority-badge ${escapeHtml(group.tasks[0]?.priority || "medium")}">${priorityText}</span>
            <span class="note-meta">${escapeHtml(rangeText)} · ${group.tasks.length} 项</span>
          </div>
        </div>
      `;
      list.appendChild(option);
    });
  }
  const modal = document.getElementById("kr-task-modal");
  if (modal) modal.classList.add("show");
}

function submitKrTaskModal() {
  const krId = runtimeState.krTaskModal.krId;
  if (!krId) return;
  const list = document.getElementById("kr-task-modal-list");
  if (!list) return;
  const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((el) => el.value);
  appState.krTaskLinks = (appState.krTaskLinks || []).filter((link) => link.krId !== krId);
  selected.forEach((title) => {
    appState.krTaskLinks.push({ krId, title });
  });
  persistLocalState();
  const kr = (appState.goalKrs || []).find((item) => item.id === krId);
  if (kr) {
    renderKrList(kr.goalId);
    renderQuarterGoals();
    renderQuarterReview();
    renderGoalReminder();
  }
  closeModal("kr-task-modal");
}

function submitGoalTaskModal() {
  const goalId = runtimeState.goalTaskModal.goalId;
  if (!goalId) return;
  const list = document.getElementById("goal-task-modal-list");
  if (!list) return;
  const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((el) => el.value);
  appState.goalTaskLinks = appState.goalTaskLinks.filter((link) => link.goalId !== goalId);
  selected.forEach((taskId) => {
    appState.goalTaskLinks.push({ goalId, taskId });
  });
  persistLocalState();
  renderQuarterGoals();
  renderQuarterReview();
  closeModal("goal-task-modal");
}

function renderQuarterReview() {
  const summary = document.getElementById("quarter-review-summary");
  const achievements = document.getElementById("quarter-review-achievements");
  const highlights = document.getElementById("quarter-review-highlights");
  const lowlights = document.getElementById("quarter-review-lowlights");
  const adjustments = document.getElementById("quarter-review-adjustments");
  const nextActions = document.getElementById("quarter-review-next-actions");
  if (!summary || !achievements || !highlights || !lowlights || !adjustments || !nextActions) return;
  ensureGoalPeriod();
  const period = appState.selectedGoalPeriod;
  const goals = (appState.quarterGoals || []).filter((goal) => goal.period === period);
  if (goals.length === 0) {
    summary.textContent = "当前季度暂无目标，完成度将随着任务自动计算。";
  } else {
    const lines = goals.map((goal) => {
      const { progress, doneCount, totalCount } = getGoalTaskProgress(goal.id);
      return `${goal.title}：${progress}%（${doneCount}/${totalCount}）`;
    });
    summary.textContent = lines.join(" | ");
  }
  const review = (appState.quarterReviews || []).find((item) => item.period === period);
  const legacyContent = review && typeof review.content === "string" ? review.content : "";
  achievements.value = review?.achievements || legacyContent || "";
  highlights.value = review?.highlights || "";
  lowlights.value = review?.lowlights || "";
  adjustments.value = review?.adjustments || "";
  nextActions.value = review?.nextActions || "";
}

function saveQuarterReview() {
  ensureGoalPeriod();
  const achievements = document.getElementById("quarter-review-achievements");
  const highlights = document.getElementById("quarter-review-highlights");
  const lowlights = document.getElementById("quarter-review-lowlights");
  const adjustments = document.getElementById("quarter-review-adjustments");
  const nextActions = document.getElementById("quarter-review-next-actions");
  if (!achievements || !highlights || !lowlights || !adjustments || !nextActions) return;
  const period = appState.selectedGoalPeriod;
  let review = (appState.quarterReviews || []).find((item) => item.period === period);
  const payload = {
    achievements: String(achievements.value || "").trim(),
    highlights: String(highlights.value || "").trim(),
    lowlights: String(lowlights.value || "").trim(),
    adjustments: String(adjustments.value || "").trim(),
    nextActions: String(nextActions.value || "").trim(),
  };
  if (review) {
    review.achievements = payload.achievements;
    review.highlights = payload.highlights;
    review.lowlights = payload.lowlights;
    review.adjustments = payload.adjustments;
    review.nextActions = payload.nextActions;
    review.updatedAt = new Date().toISOString();
  } else {
    review = {
      id: `review-${Date.now()}`,
      period,
      achievements: payload.achievements,
      highlights: payload.highlights,
      lowlights: payload.lowlights,
      adjustments: payload.adjustments,
      nextActions: payload.nextActions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    appState.quarterReviews.push(review);
  }
  persistLocalState();
  showAppAlert("季度复盘已保存。");
}

/**
 * 将优先级编码转换为文本。
 * @param {"high"|"medium"|"low"|undefined} priority 优先级。
 * @returns {string} 文本。
 */
function toPriorityText(priority) {
  if (priority === "high") return "高优先级";
  if (priority === "low") return "低优先级";
  return "中优先级";
}

function getPriorityRank(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

/**
 * 获取任务开始时间（优先使用 startAt）。
 * @param {{startAt?:string,startDate?:string,date?:string}} task 任务对象。
 * @returns {string} ISO 日期时间字符串。
 */
function getTaskStartAt(task) {
  if (task.startAt) return task.startAt;
  if (task.startDate) return `${task.startDate}T09:00`;
  return `${task.date}T09:00`;
}

/**
 * 获取任务结束时间（优先使用 endAt）。
 * @param {{endAt?:string,endDate?:string,date?:string}} task 任务对象。
 * @returns {string} ISO 日期时间字符串。
 */
function getTaskEndAt(task) {
  if (task.endAt) return task.endAt;
  if (task.endDate) return `${task.endDate}T10:00`;
  return `${task.date}T10:00`;
}

/**
 * 获取任务所属日期（YYYY-MM-DD）。
 * @param {{startAt?:string,startDate?:string,date?:string}} task 任务对象。
 * @returns {string} 日期字符串。
 */
function getTaskDateOnly(task) {
  return toDateOnly(getTaskStartAt(task));
}

/**
 * 把 ISO 日期时间转成可读文本（YYYY-MM-DD HH:mm）。
 * @param {string} value ISO 日期时间字符串。
 * @returns {string} 展示文本。
 */
function formatDateTimeDisplay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatTimeOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTimeRange(startValue, endValue) {
  return `${formatTimeOnly(startValue)} ~ ${formatTimeOnly(endValue)}`;
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * 从日期时间字符串中提取 YYYY-MM-DD。
 * @param {string} value 日期或日期时间字符串。
 * @returns {string} 日期字符串。
 */
function toDateOnly(value) {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value.slice(0, 10);
}

/**
 * 打开计划任务弹窗。
 */
function showTaskPlanModal(defaultDate) {
  runtimeState.taskEdit.mode = "create";
  runtimeState.taskEdit.taskId = "";
  runtimeState.taskEdit.seriesId = "";
  const baseDate = defaultDate || toLocalDateString(new Date());
  setValue("plan-start-date", baseDate);
  setValue("plan-end-date", baseDate);
  setValue("plan-start-time", "09:00");
  setValue("plan-end-time", "10:00");
  setValue("plan-frequency", "once");
  setValue("plan-edit-scope", "single");
  updateTaskModalUi();
  const modal = document.getElementById("task-modal");
  if (modal) modal.classList.add("show");
}

async function deleteTaskPlan() {
  if (runtimeState.taskEdit.mode !== "edit" || !runtimeState.taskEdit.taskId) {
    showAppAlert("当前不在编辑任务状态。");
    return;
  }
  const scope = getValue("plan-edit-scope") || "single";
  const target = appState.scheduleTasks.find((task) => task.id === runtimeState.taskEdit.taskId);
  if (!target) {
    showAppAlert("未找到要删除的任务。");
    return;
  }
  const ok = await showAppConfirm(scope === "all" ? "确认删除该系列的所有任务吗？" : "确认删除当天任务吗？");
  if (!ok) return;
  if (scope === "all" && runtimeState.taskEdit.seriesId) {
    const seriesId = runtimeState.taskEdit.seriesId;
    appState.scheduleTasks = appState.scheduleTasks.filter((task) => task.seriesId !== seriesId);
  } else {
    appState.scheduleTasks = appState.scheduleTasks.filter((task) => task.id !== runtimeState.taskEdit.taskId);
  }
  renderTaskList();
  renderTodayTodos();
  renderCalendar();
  persistLocalState();
  clearTaskPlanForm();
  closeModal("task-modal");
}

function updateTaskModalUi() {
  const title = document.getElementById("task-modal-title");
  const submit = document.getElementById("task-modal-submit");
  const scopeGroup = document.getElementById("plan-edit-scope-group");
  const deleteBtn = document.getElementById("task-modal-delete");
  const isEdit = runtimeState.taskEdit.mode === "edit";
  if (title) title.textContent = isEdit ? "🗓️ 编辑学习计划任务" : "🗓️ 新建学习计划任务";
  if (submit) submit.textContent = isEdit ? "保存修改" : "保存任务";
  if (scopeGroup) scopeGroup.style.display = isEdit ? "block" : "none";
  if (deleteBtn) deleteBtn.style.display = isEdit ? "inline-flex" : "none";
}

function openTaskEditModal(task) {
  runtimeState.taskEdit.mode = "edit";
  runtimeState.taskEdit.taskId = task.id;
  runtimeState.taskEdit.seriesId = task.seriesId || "";
  setValue("plan-title", task.title || "");
  setValue("plan-content", task.desc || "");
  setValue("plan-goal", task.goal || "");
  setValue("plan-priority", task.priority || "medium");
  setValue("plan-frequency", task.frequency || "once");
  const startAt = getTaskStartAt(task);
  const endAt = getTaskEndAt(task);
  setValue("plan-start-date", toDateOnly(startAt));
  setValue("plan-end-date", toDateOnly(endAt));
  setValue("plan-start-time", formatTimeOnly(startAt));
  setValue("plan-end-time", formatTimeOnly(endAt));
  setValue("plan-edit-scope", "single");
  updateTaskModalUi();
  const modal = document.getElementById("task-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 提交计划任务表单。
 */
function submitTaskPlan() {
  const title = getValue("plan-title");
  const content = getValue("plan-content");
  const goal = getValue("plan-goal") || "达成该学习任务";
  const priority = getValue("plan-priority") || "medium";
  const frequency = getValue("plan-frequency") || "once";
  const startDateInput = getValue("plan-start-date");
  const endDateInput = getValue("plan-end-date");
  const startTimeInput = getValue("plan-start-time");
  const endTimeInput = getValue("plan-end-time");

  if (!title || !content || !startDateInput || !endDateInput || !startTimeInput || !endTimeInput) {
    showAppAlert("请完整填写计划标题、内容和起止时间。");
    return;
  }
  const startAt = `${startDateInput}T${startTimeInput}`;
  const endAt = `${endDateInput}T${endTimeInput}`;
  if (new Date(startAt) > new Date(endAt)) {
    showAppAlert("开始时间不能晚于结束时间。");
    return;
  }
  const startDate = toDateOnly(startAt);
  const endDate = toDateOnly(endAt);
  const dates = buildTaskDates(startDate, endDate, frequency);
  if (dates.length === 0) {
    showAppAlert("当前频次下未生成任何任务，请调整时间范围。");
    return;
  }
  const startTime = startAt.split("T")[1] || "09:00";
  const endTime = endAt.split("T")[1] || "10:00";
  const editMode = runtimeState.taskEdit.mode === "edit" && runtimeState.taskEdit.taskId;
  const target = editMode ? appState.scheduleTasks.find((task) => task.id === runtimeState.taskEdit.taskId) : null;
  const planType = editMode ? (target?.planType || "daily") : "daily";
  if (editMode) {
    const scope = getValue("plan-edit-scope") || "single";
    if (!target) {
      showAppAlert("未找到要编辑的任务，请刷新后重试。");
      return;
    }
    if (scope === "all" && runtimeState.taskEdit.seriesId) {
      const seriesId = runtimeState.taskEdit.seriesId;
      appState.scheduleTasks = appState.scheduleTasks.filter((task) => task.seriesId !== seriesId);
      dates.forEach((date, index) => {
        appState.scheduleTasks.push({
          id: `${seriesId}-${index}`,
          title,
          desc: content,
          date,
          status: "pending",
          planType,
          priority,
          goal,
          startAt: `${date}T${startTime}`,
          endAt: `${date}T${endTime}`,
          startDate: date,
          endDate: date,
          frequency,
          seriesId,
        });
      });
    } else {
      const date = startDate;
      target.title = title;
      target.desc = content;
      target.goal = goal;
      target.planType = planType;
      target.priority = priority;
      target.frequency = frequency;
      target.startAt = `${date}T${startTime}`;
      target.endAt = `${date}T${endTime}`;
      target.startDate = date;
      target.endDate = date;
      target.date = date;
    }
  } else {
    const seriesId = `task-${Date.now()}`;
    dates.forEach((date, index) => {
      appState.scheduleTasks.push({
        id: `${seriesId}-${index}`,
        title,
        desc: content,
        date,
        status: "pending",
        planType,
        priority,
        goal,
        startAt: `${date}T${startTime}`,
        endAt: `${date}T${endTime}`,
        startDate: date,
        endDate: date,
        frequency,
        seriesId,
      });
    });
  }
  appState.selectedCalendarDate = dates[0];
  appState.currentMonthDate = new Date(`${dates[0]}T00:00`);
  renderTaskList();
  renderTodayTodos();
  renderCalendar();
  persistLocalState();
  clearTaskPlanForm();
  closeModal("task-modal");
}

/**
 * 清空计划弹窗内容。
 */
function clearTaskPlanForm() {
  setValue("plan-title", "");
  setValue("plan-content", "");
  setValue("plan-goal", "");
  setValue("plan-priority", "medium");
  setValue("plan-frequency", "once");
  setValue("plan-start-date", "");
  setValue("plan-end-date", "");
  setValue("plan-start-time", "09:00");
  setValue("plan-end-time", "10:00");
  setValue("plan-edit-scope", "single");
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTaskDates(startDate, endDate, frequency) {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00`);
  const end = new Date(`${endDate}T00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (frequency === "once") return [startDate];
  const dates = [];
  const startDay = start.getDate();
  if (frequency === "weekly" || frequency === "biweekly") {
    const step = frequency === "weekly" ? 7 : 14;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + step)) {
      dates.push(toLocalDateString(d));
    }
    return dates;
  }
  if (frequency === "monthly") {
    let cursor = new Date(start.getFullYear(), start.getMonth(), startDay);
    while (cursor <= end) {
      dates.push(toLocalDateString(cursor));
      const nextMonth = cursor.getMonth() + 1;
      const year = cursor.getFullYear() + Math.floor(nextMonth / 12);
      const month = nextMonth % 12;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const day = Math.min(startDay, daysInMonth);
      cursor = new Date(year, month, day);
    }
    return dates;
  }
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const dateNum = d.getDate();
    if (frequency === "daily") {
      dates.push(toLocalDateString(d));
      continue;
    }
    if (frequency === "workday" && day >= 1 && day <= 5) {
      dates.push(toLocalDateString(d));
      continue;
    }
    if (frequency === "weekend" && (day === 0 || day === 6)) {
      dates.push(toLocalDateString(d));
      continue;
    }
    if (frequency === "odd" && day >= 1 && day <= 5 && dateNum % 2 === 1) {
      dates.push(toLocalDateString(d));
      continue;
    }
    if (frequency === "even" && day >= 1 && day <= 5 && dateNum % 2 === 0) {
      dates.push(toLocalDateString(d));
    }
  }
  return dates;
}

/**
 * 渲染日历并标记任务日期。
 */
function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendar-title");
  if (!grid || !title) return;
  const year = appState.currentMonthDate.getFullYear();
  const month = appState.currentMonthDate.getMonth();
  title.textContent = `${year}年${month + 1}月`;

  grid.innerHTML = "";
  ["日", "一", "二", "三", "四", "五", "六"].forEach((d) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell header";
    cell.textContent = d;
    grid.appendChild(cell);
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toLocalDateString(new Date());

  for (let i = 0; i < firstDay; i += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty";
    grid.appendChild(empty);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const tasksForDate = getScheduleTasksForDate(dateStr);
    const hasTask = tasksForDate.length > 0;
    const isToday = dateStr === today;
    const isSelected = dateStr === appState.selectedCalendarDate;
    const cell = document.createElement("div");
    cell.className = `calendar-cell day${hasTask ? " has-task" : ""}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`;
    const dayLabel = document.createElement("div");
    dayLabel.className = "calendar-day-number";
    dayLabel.textContent = String(day);
    cell.appendChild(dayLabel);
    if (hasTask) {
      const badge = document.createElement("div");
      badge.className = "calendar-task-badge";
      badge.textContent = tasksForDate.length > 9 ? "9+" : String(tasksForDate.length);
      cell.appendChild(badge);
    }
    cell.addEventListener("click", () => {
      appState.selectedCalendarDate = dateStr;
      renderCalendar();
      renderTaskList();
    });
    cell.addEventListener("dblclick", (event) => {
      event.preventDefault();
      appState.selectedCalendarDate = dateStr;
      renderCalendar();
      renderTaskList();
      showTaskPlanModal(dateStr);
    });
    grid.appendChild(cell);
  }
}

/**
 * 显示上个月日历。
 */
function prevMonth() {
  const d = new Date(appState.currentMonthDate);
  d.setMonth(d.getMonth() - 1);
  appState.currentMonthDate = d;
  renderCalendar();
}

/**
 * 显示下个月日历。
 */
function nextMonth() {
  const d = new Date(appState.currentMonthDate);
  d.setMonth(d.getMonth() + 1);
  appState.currentMonthDate = d;
  renderCalendar();
}

/**
 * 渲染动态艾宾浩斯提醒。
 */
function renderReviewTimeline() {
  const wrap = document.getElementById("review-timeline");
  const summary = document.getElementById("review-summary");
  if (!wrap || !summary) return;
  const reminders = buildReviewReminders();
  wrap.innerHTML = "";
  if (reminders.length === 0) {
    wrap.innerHTML = '<div class="review-item completed"><div class="review-day">暂无待复习</div><div class="review-date">继续保持学习节奏 ✅</div></div>';
    summary.textContent = "当前没有需要提醒的复习项。";
    renderEbbinghausChart();
    return;
  }
  reminders.forEach((item) => {
    const node = document.createElement("div");
    node.className = `review-item ${item.statusClass}`;
    node.innerHTML = `<div class="review-day">${escapeHtml(item.docName)}</div><div class="review-date">${escapeHtml(item.label)}</div>`;
    wrap.appendChild(node);
  });
  summary.textContent = `今日复习提醒 ${reminders.length} 条，建议优先处理“已超时”内容。`;
  renderEbbinghausChart();
}

/**
 * 渲染艾宾浩斯曲线图（基于当前学习记录动态高亮今日阶段）。
 */
function renderEbbinghausChart() {
  const chart = document.getElementById("ebbinghaus-chart");
  const desc = document.getElementById("ebbinghaus-chart-desc");
  if (!chart || !desc) return;
  const checkpoints = [1, 2, 4, 7, 15, 30];
  const rates = [100, 85, 65, 45, 30, 20];
  const reminders = buildReviewReminders();
  const todayStages = new Set(
    reminders
      .map((item) => {
        const matched = String(item.label || "").match(/Day\s+(\d+)/i);
        return matched ? Number(matched[1]) : 0;
      })
      .filter((v) => v > 0)
  );
  chart.innerHTML = "";
  checkpoints.forEach((day, index) => {
    const node = document.createElement("div");
    node.className = "chart-item";
    node.style.setProperty("--height", `${rates[index]}%`);
    node.innerHTML = `<div class="chart-bar ${todayStages.has(day) ? "active" : ""}"></div><span class="chart-label">Day ${day}</span>`;
    chart.appendChild(node);
  });
  desc.textContent = reminders.length > 0
    ? `今日复习命中 ${reminders.length} 条，建议按 Day 阶段优先处理。`
    : "记忆保留率随时间递减，定期复习可有效巩固。";
}

/**
 * 基于学习记录计算复习提醒。
 * @returns {Array<{docName:string,label:string,statusClass:string}>} 提醒数组。
 */
function buildReviewReminders() {
  const checkpoints = [2, 4, 7, 15, 30];
  const today = startOfDay(new Date());
  const result = [];
  appState.learningRecords.forEach((record) => {
    const last = startOfDay(new Date(record.lastStudyAt));
    const passed = Math.floor((today - last) / (24 * 3600 * 1000));
    if (passed < 2) return;
    let target = checkpoints[0];
    checkpoints.forEach((day) => {
      if (passed >= day) target = day;
    });
    const overdue = passed - target;
    result.push({
      docName: record.docName,
      label: overdue > 0 ? `应在 Day ${target} 复习，已超时 ${overdue} 天：${record.noteHint}` : `今天是 Day ${target} 复习日：${record.noteHint}`,
      statusClass: overdue > 0 ? "overdue" : "current",
    });
  });
  return result;
}

/**
 * 更新文档学习记录日期。
 * @param {string} docName 文档名。
 */
function updateLearningRecord(docName) {
  const file = appState.libraryFiles.find((item) => item.name === docName);
  if (file) {
    syncLearningRecordByFile(file.id);
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  const existing = appState.learningRecords.find((item) => item.docName === docName);
  if (existing) {
    existing.lastStudyAt = today;
    if (!existing.noteHint) existing.noteHint = "复习学习笔记与核心内容";
  } else {
    appState.learningRecords.push({
      id: `doc-${Date.now()}`,
      docName,
      category: "未分类",
      lastStudyAt: today,
      noteHint: "复习学习笔记与核心内容",
    });
  }
}

/**
 * 渲染题库分类下拉。
 */
function renderQuestionCategoryOptions() {
  const select = document.getElementById("question-category-select");
  const sourceSelect = document.getElementById("question-source-filter");
  if (!select) return;
  const current = select.value || "all";
  const categories = getAllQuestionCategories();
  select.innerHTML = '<option value="all">全部分类</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  select.value = categories.includes(current) || current === "all" ? current : "all";
  if (sourceSelect) {
    sourceSelect.value = appState.questionSourceFilter || "all";
  }
}

/**
 * 渲染“添加知识点”弹窗中的分类下拉选项。
 */
function renderQuestionFormCategoryOptions() {
  const select = document.getElementById("question-category");
  if (!select) return;
  const categories = getAllQuestionCategories();
  const current = select.value || categories[0] || "";
  select.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  if (categories.includes(current)) {
    select.value = current;
  } else if (categories[0]) {
    select.value = categories[0];
  }
}

/**
 * 获取题库可选分类集合（手动分类 + 已存在条目分类）。
 * @returns {string[]} 分类数组。
 */
function getAllQuestionCategories() {
  const merged = new Set();
  (appState.questionCategories || []).forEach((item) => {
    const name = String(item || "").trim();
    if (name) merged.add(name);
  });
  appState.questionBank.forEach((item) => {
    const name = String(item?.category || "").trim();
    if (name) merged.add(name);
  });
  if (merged.size === 0) merged.add("英语每日新词");
  return Array.from(merged);
}

/**
 * 打开“新增题库分类”弹窗。
 */
function showAddQuestionCategoryPrompt() {
  setValue("question-category-name-input", "");
  const modal = document.getElementById("question-category-modal");
  if (modal) modal.classList.add("show");
}

function openQuestionCategoryEditModal() {
  const current = getValue("question-category-select");
  if (!current || current === "all") {
    showAppAlert("请先选择要编辑的分类。");
    return;
  }
  setValue("question-category-edit-input", current);
  const modal = document.getElementById("question-category-edit-modal");
  if (modal) modal.classList.add("show");
}

function submitQuestionCategoryEdit() {
  const original = getValue("question-category-select");
  if (!original || original === "all") {
    showAppAlert("请选择需要编辑的分类。");
    return;
  }
  const next = getValue("question-category-edit-input");
  if (!next) {
    showAppAlert("请输入分类名称。");
    return;
  }
  if (original === next) {
    closeModal("question-category-edit-modal");
    return;
  }
  if (!Array.isArray(appState.questionCategories)) appState.questionCategories = [];
  if (appState.questionCategories.includes(next)) {
    showAppAlert("分类名称已存在。");
    return;
  }
  appState.questionCategories = appState.questionCategories.map((item) => (item === original ? next : item));
  appState.questionBank.forEach((item) => {
    if (item.category === original) item.category = next;
  });
  renderQuestionCategoryOptions();
  renderQuestionFormCategoryOptions();
  setValue("question-category-select", next);
  closeModal("question-category-edit-modal");
  refreshQuestionList();
}

async function deleteQuestionCategory() {
  const current = getValue("question-category-select");
  if (!current || current === "all") {
    showAppAlert("请选择要删除的分类。");
    return;
  }
  const ok = await showAppConfirm(`确认删除分类“${current}”及其题目吗？`);
  if (!ok) return;
  appState.questionCategories = (appState.questionCategories || []).filter((item) => item !== current);
  appState.questionBank = (appState.questionBank || []).filter((item) => item.category !== current);
  renderQuestionCategoryOptions();
  renderQuestionFormCategoryOptions();
  setValue("question-category-select", "all");
  refreshQuestionList();
}

/**
 * 提交题库分类新增弹窗。
 */
function submitQuestionCategoryModal() {
  const category = getValue("question-category-name-input");
  if (!category) {
    showAppAlert("请先输入分类名称。");
    return;
  }
  if (!Array.isArray(appState.questionCategories)) appState.questionCategories = [];
  if (appState.questionCategories.includes(category)) {
    showAppAlert("该分类已存在。");
    return;
  }
  appState.questionCategories.push(category);
  renderQuestionCategoryOptions();
  renderQuestionFormCategoryOptions();
  setValue("question-category", category);
  closeModal("question-category-modal");
  persistLocalState();
}

/**
 * 打开题库新增弹窗。
 */
function showQuestionBankModal() {
  const modal = document.getElementById("question-modal");
  renderQuestionFormCategoryOptions();
  if (modal) modal.classList.add("show");
}

/**
 * 打开题库批量导入弹窗，并初始化默认分类。
 */
function showQuestionBatchImportModal() {
  const categoryInput = document.getElementById("batch-default-category");
  const formatSelect = document.getElementById("batch-import-format");
  const textArea = document.getElementById("batch-import-text");
  if (categoryInput && !categoryInput.value.trim()) {
    categoryInput.value = getQuestionBankCategoriesForChat()[0] || "英语每日新词";
  }
  if (formatSelect) formatSelect.value = "pipe";
  if (textArea && !textArea.value.trim()) {
    textArea.value = "英语每日新词|resilience是什么意思？|复原力、韧性\n英语每日短语学习|Break the ice是什么意思？|打破僵局";
  }
  const modal = document.getElementById("question-batch-modal");
  if (modal) modal.classList.add("show");
}

/**
 * 提交批量导入内容并写入题库（带去重）。
 */
function submitQuestionBatchImport() {
  const format = getValue("batch-import-format") || "pipe";
  const defaultCategory = getValue("batch-default-category") || "英语每日新词";
  const text = getValue("batch-import-text");
  if (!text) {
    showAppAlert("请先粘贴批量导入内容。");
    return;
  }

  const items = parseQuestionBatchItems(text, format, defaultCategory);
  if (items.length === 0) {
    showAppAlert("未解析出有效题目，请检查格式后重试。");
    return;
  }

  let added = 0;
  let duplicated = 0;
  items.forEach((item) => {
    const result = addQuestionBankItemWithDedupe({
      category: item.category,
      content: item.content,
      answer: item.answer,
      source: "manual",
    }, { persist: false, render: false });
    if (result.added) {
      added += 1;
    } else {
      duplicated += 1;
    }
  });
  renderQuestionCategoryOptions();
  renderQuestionBankSummary();
  persistLocalState();
  closeModal("question-batch-modal");
  showAppAlert(`批量导入完成：新增 ${added} 条，重复跳过 ${duplicated} 条。`);
}

/**
 * 根据导入格式解析文本为题库条目数组。
 * @param {string} rawText 原始导入文本。
 * @param {"pipe"|"qa"|string} format 导入格式标识。
 * @param {string} defaultCategory 默认分类。
 * @returns {Array<{category:string,content:string,answer:string}>} 解析结果。
 */
function parseQuestionBatchItems(rawText, format, defaultCategory) {
  if (format === "qa") {
    return parseQaBatchFormat(rawText, defaultCategory);
  }
  return parsePipeBatchFormat(rawText, defaultCategory);
}

/**
 * 解析“分类|题目|答案”行格式。
 * @param {string} rawText 原始文本。
 * @param {string} defaultCategory 默认分类。
 * @returns {Array<{category:string,content:string,answer:string}>} 解析结果。
 */
function parsePipeBatchFormat(rawText, defaultCategory) {
  const lines = String(rawText || "").split(/\r?\n/);
  const items = [];
  lines.forEach((line) => {
    const content = line.trim();
    if (!content || content.startsWith("#")) return;
    const parts = content.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return;
    if (parts.length >= 3) {
      items.push({
        category: parts[0] || defaultCategory,
        content: parts[1],
        answer: parts.slice(2).join(" | "),
      });
      return;
    }
    items.push({
      category: defaultCategory,
      content: parts[0],
      answer: parts[1],
    });
  });
  return items.filter((item) => item.category && item.content && item.answer);
}

/**
 * 解析“Q:/A:”块格式，支持可选“分类: xxx”行。
 * @param {string} rawText 原始文本。
 * @param {string} defaultCategory 默认分类。
 * @returns {Array<{category:string,content:string,answer:string}>} 解析结果。
 */
function parseQaBatchFormat(rawText, defaultCategory) {
  const lines = String(rawText || "").split(/\r?\n/);
  const items = [];
  let category = defaultCategory;
  let question = "";
  let answer = "";
  let mode = "";

  /**
   * 将当前缓存的一条问答写入结果。
   */
  function flushCurrent() {
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a) return;
    items.push({
      category: category || defaultCategory,
      content: q,
      answer: a,
    });
    question = "";
    answer = "";
    mode = "";
  }

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      if (mode === "answer") answer += "\n";
      return;
    }
    if (/^---+$/.test(text)) {
      flushCurrent();
      return;
    }
    if (/^分类\s*[:：]/.test(text)) {
      const parsedCategory = text.replace(/^分类\s*[:：]/, "").trim();
      if (parsedCategory) category = parsedCategory;
      return;
    }
    if (/^Q\s*[:：]/i.test(text)) {
      if (question && answer) flushCurrent();
      question = text.replace(/^Q\s*[:：]/i, "").trim();
      mode = "question";
      return;
    }
    if (/^A\s*[:：]/i.test(text)) {
      answer = text.replace(/^A\s*[:：]/i, "").trim();
      mode = "answer";
      return;
    }
    if (mode === "answer") {
      answer = `${answer}\n${text}`.trim();
    } else if (mode === "question") {
      question = `${question} ${text}`.trim();
    }
  });
  flushCurrent();
  return items.filter((item) => item.category && item.content && item.answer);
}

/**
 * 标准化题库比较文本，避免大小写和空白差异导致重复。
 * @param {string} text 原始文本。
 * @returns {string} 标准化文本。
 */
function normalizeQuestionBankText(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function refreshQuestionList() {
  const category = getValue("question-category-select") || "all";
  const sourceFilter = getValue("question-source-filter") || appState.questionSourceFilter || "all";
  const count = sanitizeCount(getValue("random-count"), 10, 50);
  const source = filterQuestionBankItems(category, sourceFilter);
  const isRandom = appState.randomMode !== "sequential";
  renderQuestionList(source, count, isRandom, sourceFilter);
  renderQuestionBankSummary();
  persistLocalState();
}

/**
 * 带去重策略地新增题库条目，并刷新相关 UI。
 * @param {{category:string,content:string,answer:string,source?:string}} payload 题目对象。
 * @param {{persist?:boolean,render?:boolean}} options 附加配置。
 * @returns {{added:boolean,message:string}} 处理结果。
 */
function addQuestionBankItemWithDedupe(payload, options = {}) {
  const category = String(payload?.category || "").trim();
  const content = String(payload?.content || "").trim();
  const answer = String(payload?.answer || "").trim();
  const source = String(payload?.source || "manual");
  if (!category || !content || !answer) {
    return { added: false, message: "分类、题目、答案不能为空" };
  }

  const normCategory = normalizeQuestionBankText(category);
  const normContent = normalizeQuestionBankText(content);
  if (!Array.isArray(appState.questionCategories)) appState.questionCategories = [];
  if (!appState.questionCategories.includes(category)) {
    appState.questionCategories.push(category);
  }
  const exists = appState.questionBank.find((item) => (
    normalizeQuestionBankText(item.category) === normCategory
    && normalizeQuestionBankText(item.content) === normContent
  ));
  if (exists) {
    return { added: false, message: "该分类下已存在同题目" };
  }

  appState.questionBank.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    category,
    content,
    answer,
    source,
    createdAt: new Date().toISOString(),
  });
  const shouldRender = options.render !== false;
  const shouldPersist = options.persist !== false;
  if (shouldRender) {
    renderQuestionCategoryOptions();
    renderQuestionFormCategoryOptions();
    renderQuestionBankSummary();
  }
  if (shouldPersist) persistLocalState();
  return { added: true, message: "已加入随机题库" };
}

/**
 * 统计指定文件下全部高亮条数。
 * @param {string} fileId 文件 id。
 * @returns {number} 高亮总数。
 */
function countHighlightsByFile(fileId) {
  const pages = appState.workspaceData[fileId]?.pages;
  if (!Array.isArray(pages)) return 0;
  return pages.reduce((sum, page) => sum + (Array.isArray(page.highlights) ? page.highlights.length : 0), 0);
}

/**
 * 保存时把新增学习痕迹自动同步到题库（去重）。
 * @param {string} fileId 文件 id。
 */
function syncRecentStudyToQuestionBank(fileId) {
  if (appState.autoSyncQuestionBank === false) return;
  const data = appState.workspaceData[fileId];
  if (!data) return;
  if (!data.syncState || typeof data.syncState !== "object") {
    data.syncState = { lastNoteCount: 0, lastHighlightCount: 0 };
  }

  const noteCount = Array.isArray(data.notes) ? data.notes.length : 0;
  const highCount = countHighlightsByFile(fileId);
  const noteStart = Math.max(0, data.syncState.lastNoteCount || 0);
  const highStart = Math.max(0, data.syncState.lastHighlightCount || 0);

  const newNotes = Array.isArray(data.notes) ? data.notes.slice(noteStart) : [];
  const allHighlights = Array.isArray(data.pages)
    ? data.pages.flatMap((page) => (Array.isArray(page.highlights) ? page.highlights : []))
    : [];
  const newHighlights = allHighlights.slice(highStart);

  const file = appState.libraryFiles.find((item) => item.id === fileId);
  const category = file ? `${buildCategoryPath(file.categoryId)} · 自动同步` : "学习痕迹自动同步";

  const syncLimit = sanitizeCount(String(appState.autoSyncMaxPerSave || 5), 5, 20);
  newNotes.slice(0, syncLimit).forEach((note) => {
    addQuestionBankItemWithDedupe({
      category,
      content: `笔记复习：${String(note.text || "").trim()}`,
      answer: `来源：${file ? file.name : "当前文件"}（笔记）`,
      source: "auto-note",
    }, { persist: false, render: false });
  });
  newHighlights.slice(0, syncLimit).forEach((high) => {
    addQuestionBankItemWithDedupe({
      category,
      content: `高亮复习：${String(high.text || "").trim()}`,
      answer: `来源：${file ? file.name : "当前文件"}（高亮）`,
      source: "auto-highlight",
    }, { persist: false, render: false });
  });

  data.syncState.lastNoteCount = noteCount;
  data.syncState.lastHighlightCount = highCount;
}

/**
 * 按文件数据更新学习记录摘要，形成“学习-复习”闭环。
 * @param {string} fileId 文件 id。
 */
function syncLearningRecordByFile(fileId) {
  const file = appState.libraryFiles.find((item) => item.id === fileId);
  if (!file) return;
  const data = appState.workspaceData[fileId] || { notes: [], pages: [] };
  const noteCount = Array.isArray(data.notes) ? data.notes.length : 0;
  const highCount = countHighlightsByFile(fileId);
  const today = new Date().toISOString().split("T")[0];
  const category = buildCategoryPath(file.categoryId) || "未分类";
  const noteHint = `复习建议：笔记 ${noteCount} 条，高亮 ${highCount} 条`;

  const existing = appState.learningRecords.find((item) => item.docName === file.name);
  if (existing) {
    existing.lastStudyAt = today;
    existing.category = category;
    existing.noteHint = noteHint;
  } else {
    appState.learningRecords.push({
      id: `doc-${Date.now()}`,
      docName: file.name,
      category,
      lastStudyAt: today,
      noteHint,
    });
  }
}

/**
 * 获取聊天面板可用的题库分类列表。
 * @returns {string[]} 分类数组。
 */
function getQuestionBankCategoriesForChat() {
  const categories = getAllQuestionCategories();
  if (categories.length === 0) categories.push("英语每日新词");
  return categories;
}

/**
 * 提交新增题库知识点。
 */
function submitQuestionBankItem() {
  const category = getValue("question-category");
  const content = getValue("question-content");
  const answer = getValue("question-answer");
  const result = addQuestionBankItemWithDedupe({
    category,
    content,
    answer,
    source: "manual",
  });
  if (!result.added) {
    showAppAlert(result.message);
    return;
  }
  setValue("question-content", "");
  setValue("question-answer", "");
  closeModal("question-modal");
}

/**
 * 随机抽取题库条目。
 */
function drawRandomQuestions() {
  const category = getValue("question-category-select") || "all";
  const sourceFilter = getValue("question-source-filter") || appState.questionSourceFilter || "all";
  appState.questionSourceFilter = sourceFilter;
  const count = sanitizeCount(getValue("random-count"), 10, 50);
  const source = filterQuestionBankItems(category, sourceFilter);
  appState.randomPage = 1;
  appState.randomMode = "random";
  renderQuestionList(source, count, true, sourceFilter);
  persistLocalState();
}

/**
 * 按数量顺序罗列题库条目。
 */
function renderAllByCount() {
  const category = getValue("question-category-select") || "all";
  const sourceFilter = getValue("question-source-filter") || appState.questionSourceFilter || "all";
  appState.questionSourceFilter = sourceFilter;
  const count = sanitizeCount(getValue("random-count"), 10, 50);
  const source = filterQuestionBankItems(category, sourceFilter);
  appState.randomPage = 1;
  appState.randomMode = "sequential";
  renderQuestionList(source, count, false, sourceFilter);
  persistLocalState();
}

/**
 * 渲染题库列表（随机或顺序）。
 * @param {Array<{id:number,category:string,content:string,answer:string}>} source 来源数组。
 * @param {number} count 展示数量。
 * @param {boolean} random 是否随机模式。
 * @param {string} sourceFilter 来源筛选值。
 */
function renderQuestionList(source, count, random, sourceFilter = "all") {
  const list = document.getElementById("random-question-list");
  const summary = document.getElementById("random-summary");
  const prev = document.getElementById("random-prev-btn");
  const next = document.getElementById("random-next-btn");
  const info = document.getElementById("random-page-info");
  if (!list || !summary) return;
  if (source.length === 0) {
    list.innerHTML = "";
    summary.textContent = "当前分类暂无知识点，请先添加。";
    if (prev && next && info) {
      prev.disabled = true;
      next.disabled = true;
      info.textContent = "";
    }
    return;
  }
  const arr = random ? [...source].sort(() => Math.random() - 0.5) : [...source];
  const pageSize = Math.min(count, source.length);
  const totalPages = Math.max(1, Math.ceil(arr.length / pageSize));
  const currentPage = Math.min(Math.max(1, appState.randomPage || 1), totalPages);
  appState.randomPage = currentPage;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const selected = arr.slice(startIndex, endIndex);
  list.innerHTML = "";
  selected.forEach((item, index) => {
    const node = document.createElement("details");
    node.className = "question-item";
    const sourceLabel = toQuestionSourceLabel(item.source);
    const summaryEl = document.createElement("summary");
    summaryEl.className = "question-summary";
    const text = document.createElement("span");
    text.className = "question-summary-text";
    text.textContent = `Q${startIndex + index + 1} · ${item.category} · [${sourceLabel}] · ${item.content}`;
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn-secondary";
    toggleBtn.textContent = "详情/编辑";
    toggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      node.open = !node.open;
    });
    summaryEl.appendChild(text);
    summaryEl.appendChild(toggleBtn);
    const detail = document.createElement("div");
    detail.className = "question-detail";
    const answer = document.createElement("div");
    answer.className = "question-answer";
    answer.textContent = `答案：${item.answer}`;
    /** 展开后先只显示答案，再点按钮才显示笔记区 */
    const notesToggleRow = document.createElement("div");
    notesToggleRow.className = "question-notes-toggle-row";
    const notesToggleBtn = document.createElement("button");
    notesToggleBtn.type = "button";
    notesToggleBtn.className = "btn-secondary";
    notesToggleBtn.textContent = "显示详情笔记";
    const notesPanel = document.createElement("div");
    notesPanel.className = "question-notes-panel";
    notesPanel.hidden = true;
    const noteDisplay = document.createElement("div");
    noteDisplay.className = "question-note-display";
    const normalizedNote = String(item.note || "").trim();
    noteDisplay.textContent = normalizedNote || "暂无笔记，点击下方按钮添加。";
    if (!normalizedNote) noteDisplay.classList.add("is-empty");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-secondary question-note-edit-btn";
    editBtn.textContent = normalizedNote ? "编辑笔记" : "添加笔记";
    const editor = document.createElement("div");
    editor.className = "question-editor question-notes-only";
    editor.hidden = true;
    const noteInput = document.createElement("textarea");
    noteInput.className = "setting-input";
    noteInput.value = item.note || "";
    noteInput.placeholder = "学习笔记";
    noteInput.rows = 4;
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "question-note-save-btn";
    saveBtn.textContent = "保存修改";
    saveBtn.addEventListener("click", () => {
      item.note = noteInput.value.trim();
      persistLocalState();
      const latestNote = String(item.note || "").trim();
      noteDisplay.textContent = latestNote || "暂无笔记，点击下方按钮添加。";
      noteDisplay.classList.toggle("is-empty", !latestNote);
      editor.hidden = true;
      noteDisplay.hidden = false;
      editBtn.textContent = latestNote ? "编辑笔记" : "添加笔记";
    });
    editBtn.addEventListener("click", () => {
      const willEdit = editor.hidden;
      editor.hidden = !willEdit;
      noteDisplay.hidden = willEdit;
      editBtn.textContent = willEdit ? "取消编辑" : (String(item.note || "").trim() ? "编辑笔记" : "添加笔记");
      if (willEdit) noteInput.focus();
    });
    notesToggleBtn.addEventListener("click", () => {
      const show = notesPanel.hidden;
      notesPanel.hidden = !show;
      notesToggleBtn.textContent = show ? "收起笔记" : "显示详情笔记";
    });
    editor.appendChild(noteInput);
    editor.appendChild(saveBtn);
    notesPanel.appendChild(noteDisplay);
    notesPanel.appendChild(editBtn);
    notesPanel.appendChild(editor);
    notesToggleRow.appendChild(notesToggleBtn);
    detail.appendChild(answer);
    detail.appendChild(notesToggleRow);
    detail.appendChild(notesPanel);
    node.appendChild(summaryEl);
    node.appendChild(detail);
    list.appendChild(node);
  });
  const sourceText = sourceFilter === "all" ? "全部来源" : toQuestionSourceLabel(sourceFilter);
  summary.textContent = `${random ? "已随机抽取" : "已按数量罗列"} 第 ${currentPage} / ${totalPages} 页（每页 ${pageSize} 条，${sourceText}）。`;
  if (prev && next && info) {
    prev.disabled = currentPage <= 1;
    next.disabled = currentPage >= totalPages;
    info.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${arr.length} 条`;
  }
}

/**
 * 按分类与来源筛选题库。
 * @param {string} category 分类名或 all。
 * @param {string} sourceFilter 来源筛选值或 all。
 * @returns {Array<{id:number,category:string,content:string,answer:string}>} 题目列表。
 */
function filterQuestionBankItems(category, sourceFilter) {
  return appState.questionBank.filter((item) => {
    const categoryPass = category === "all" || item.category === category;
    const sourcePass = sourceFilter === "all" || String(item.source || "manual") === sourceFilter;
    return categoryPass && sourcePass;
  });
}

/**
 * 将题库来源编码转换为展示文本。
 * @param {string} source 来源编码。
 * @returns {string} 展示文本。
 */
function toQuestionSourceLabel(source) {
  if (source === "extract") return "一键提炼";
  if (source === "rag-local") return "RAG本地";
  if (source === "rag-remote") return "RAG远端";
  if (source === "auto-note") return "自动笔记";
  if (source === "auto-highlight") return "自动高亮";
  return "手动添加";
}

/**
 * 规范化题库抽取数量输入。
 * @param {string} raw 原始输入。
 * @param {number} fallback 默认值。
 * @param {number} max 最大值。
 * @returns {number} 处理后的数量。
 */
function sanitizeCount(raw, fallback, max) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function sanitizeFloat(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function changeRandomPage(delta) {
  const next = (appState.randomPage || 1) + delta;
  appState.randomPage = Math.max(1, next);
  const category = getValue("question-category-select") || "all";
  const sourceFilter = getValue("question-source-filter") || appState.questionSourceFilter || "all";
  const count = sanitizeCount(getValue("random-count"), 10, 50);
  const source = filterQuestionBankItems(category, sourceFilter);
  const isRandom = appState.randomMode !== "sequential";
  renderQuestionList(source, count, isRandom, sourceFilter);
}
/**
 * 渲染题库统计摘要。
 */
function renderQuestionBankSummary() {
  const summary = document.getElementById("random-summary");
  if (!summary) return;
  const categoryCount = new Set(appState.questionBank.map((q) => q.category)).size;
  const sourceFilter = appState.questionSourceFilter || "all";
  const selectedCategory = getValue("question-category-select") || "all";
  const filtered = filterQuestionBankItems(selectedCategory, sourceFilter);
  const sourceText = sourceFilter === "all" ? "全部来源" : toQuestionSourceLabel(sourceFilter);
  const categoryText = selectedCategory === "all" ? "全部分类" : selectedCategory;
  summary.textContent = `题库共 ${appState.questionBank.length} 条知识点，覆盖 ${categoryCount} 个分类；当前筛选（${categoryText} / ${sourceText}）共 ${filtered.length} 条。`;
}

/**
 * 切换沉浸模式显示状态。
 */
function toggleVibeMode() {
  const overlay = document.getElementById("vibe-overlay");
  if (!overlay) return;
  overlay.classList.toggle("show");
}

/**
 * 播放 Lo-fi 占位逻辑。
 */
function playLofi() {
  showAppAlert("Lo-fi 播放中（演示模式）");
}

/**
 * 停止 Lo-fi 占位逻辑。
 */
function stopLofi() {
  showAppAlert("Lo-fi 已停止（演示模式）");
}

/**
 * 阅读器上一页。
 */
async function prevPage() {
  appState.currentDocPage = Math.max(1, appState.currentDocPage - 1);
  await loadActiveWorkspaceFile();
  syncPageIndicator();
}

/**
 * 阅读器下一页。
 */
async function nextPage() {
  const fileId = appState.activeFileId;
  const total = appState.workspaceData[fileId]?.pages?.length || appState.totalDocPages;
  appState.currentDocPage = Math.min(total, appState.currentDocPage + 1);
  await loadActiveWorkspaceFile();
  syncPageIndicator();
}

/**
 * 同步阅读器页码显示。
 */
function syncPageIndicator() {
  const indicator = document.getElementById("page-indicator");
  if (!indicator) return;
  indicator.textContent = `${appState.currentDocPage} / ${appState.totalDocPages}`;
}

function syncWorkspaceZoomUi(file) {
  const label = document.getElementById("workspace-zoom-indicator");
  const minusBtn = document.getElementById("workspace-zoom-out-btn");
  const plusBtn = document.getElementById("workspace-zoom-in-btn");
  const resetBtn = document.getElementById("workspace-zoom-reset-btn");
  if (!label || !minusBtn || !plusBtn || !resetBtn) return;
  const activeFile = file || appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  const isPdf = activeFile?.type === "PDF" && appState.workspaceViewMode !== "text";
  label.textContent = isPdf ? `${Math.round(appState.workspacePdfZoom)}% · Ctrl+滚轮` : "文本";
  minusBtn.disabled = !isPdf;
  plusBtn.disabled = !isPdf;
  resetBtn.disabled = !isPdf;
}

function syncHighlightColorPicker() {
  const wrap = document.getElementById("highlight-color-picker");
  if (!wrap) return;
  const current = HIGHLIGHT_COLORS[appState.highlightColor] ? appState.highlightColor : "yellow";
  wrap.querySelectorAll(".color-dot").forEach((btn) => {
    const isActive = btn.dataset.color === current;
    btn.classList.toggle("active", isActive);
  });
}

function syncHighlightStylePicker() {
  const wrap = document.getElementById("highlight-style-picker");
  if (!wrap) return;
  const current = HIGHLIGHT_STYLES[appState.highlightStyle] ? appState.highlightStyle : "fill";
  wrap.querySelectorAll(".style-dot").forEach((btn) => {
    const isActive = btn.dataset.style === current;
    btn.classList.toggle("active", isActive);
  });
}

function setHighlightColor(color) {
  if (!HIGHLIGHT_COLORS[color]) return;
  appState.highlightColor = color;
  syncHighlightColorPicker();
  persistLocalState();
}

function setHighlightStyle(style) {
  if (!HIGHLIGHT_STYLES[style]) return;
  appState.highlightStyle = style;
  syncHighlightStylePicker();
  persistLocalState();
}

function bindWorkspaceZoomWheel() {
  const reader = document.getElementById("reader-content");
  if (!reader || reader.dataset.zoomWheelBound === "true") return;
  reader.dataset.zoomWheelBound = "true";
  reader.addEventListener("wheel", (event) => {
    const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
    const isPdf = file?.type === "PDF" && appState.workspaceViewMode !== "text";

    if (event.ctrlKey) {
      if (!isPdf) return;
      event.preventDefault();
      if (!runtimeState.ui.zoomTipShown) {
        runtimeState.ui.zoomTipShown = true;
        showAppAlert("已启用 Ctrl + 滚轮 缩放。你也可以用右上角的 +/- 按钮。", "快捷缩放");
      }
      const nextZoom = event.deltaY < 0 ? appState.workspacePdfZoom + 10 : appState.workspacePdfZoom - 10;
      const normalized = Math.max(40, Math.min(260, Math.round(nextZoom / 5) * 5));
      if (normalized === appState.workspacePdfZoom) return;
      appState.workspacePdfZoom = normalized;
      persistLocalState();
      syncWorkspaceZoomUi(file);
      if (runtimeState.ui.zoomTimer) {
        clearTimeout(runtimeState.ui.zoomTimer);
      }
      runtimeState.ui.zoomTimer = setTimeout(() => {
        runtimeState.ui.zoomTimer = null;
        void loadActiveWorkspaceFile();
      }, 90);
      return;
    }

  }, { passive: false });
}

async function zoomWorkspaceOut() {
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  if (!file || file.type !== "PDF" || appState.workspaceViewMode === "text") return;
  appState.workspacePdfZoom = Math.max(40, Math.round((appState.workspacePdfZoom - 10) / 5) * 5);
  persistLocalState();
  await loadActiveWorkspaceFile();
}

async function zoomWorkspaceIn() {
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  if (!file || file.type !== "PDF" || appState.workspaceViewMode === "text") return;
  appState.workspacePdfZoom = Math.min(260, Math.round((appState.workspacePdfZoom + 10) / 5) * 5);
  persistLocalState();
  await loadActiveWorkspaceFile();
}

async function resetWorkspaceZoom() {
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  if (!file || file.type !== "PDF" || appState.workspaceViewMode === "text") return;
  appState.workspacePdfZoom = 100;
  persistLocalState();
  await loadActiveWorkspaceFile();
}

/**
 * 获取 RAG 服务接口地址（可选）。
 * @returns {string} 接口地址，不配置时返回空字符串。
 */
function getRagEndpoint() {
  const fromConfig = window.ClawMindConfig?.ragEndpoint;
  if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
  const fromLocal = localStorage.getItem("clawmind-rag-endpoint");
  if (typeof fromLocal === "string" && fromLocal.trim()) return fromLocal.trim();
  return "";
}

function getWorkspaceSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "";
  const text = selection.toString().trim();
  if (!text) return "";
  const reader = document.getElementById("reader-content");
  if (!reader) return "";
  const range = selection.getRangeAt(0);
  if (!reader.contains(range.commonAncestorContainer)) return "";
  return text;
}

/**
 * 组装当前工作区文档的 RAG 检索上下文。
 * @returns {{
 *  fileName:string,
 *  currentPage:number,
 *  pages:Array<{html:string,highlights:Array<{text:string}>}>,
 *  selectedText:string,
 *  notes:Array<{text:string}>
 * }} 上下文对象。
 */
function buildRagContext() {
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  const data = appState.workspaceData[appState.activeFileId] || { pages: [], notes: [] };
  const page = getActiveWorkspacePage();
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];
  const selectedText = getWorkspaceSelectedText();
  const pageHtml = page?.html && typeof page.html === "string" ? page.html : "";
  const pageHighlights = Array.isArray(page?.highlights) ? page.highlights : [];
  return {
    fileName: file ? file.name : "未命名文档",
    currentPage: appState.currentDocPage || 1,
    pages: [
      {
        html: pageHtml,
        highlights: pageHighlights,
      },
    ],
    selectedText,
    notes: notes.map((note) => ({
      text: typeof note.text === "string" ? note.text : "",
    })),
  };
}

/**
 * 获取聊天控制器（按需初始化单例）。
 * @returns {any} 聊天控制器实例。
 */
function getOrCreateChatController() {
  if (!window.ClawMindChat?.createChatController) return null;
  if (runtimeState.chatController) return runtimeState.chatController;
  runtimeState.chatController = window.ClawMindChat.createChatController({
    getInputElement: () => document.getElementById("chat-input"),
    getMessageListElement: () => document.getElementById("chat-messages"),
    escapeHtml,
    buildRagContext,
    getRagEndpoint,
    askCustomModel: null,
    askStreamChat: (query, context, onChunk) => askConfiguredModelStream(query, context, onChunk),
    getModelConfigStatus,
    getLastModelError: () => String(runtimeState.chat.lastModelError || ""),
    askBackendRag,
    getQuestionCategories: getQuestionBankCategoriesForChat,
    addToQuestionBank: addQuestionBankItemWithDedupe,
  });
  return runtimeState.chatController;
}

/**
 * 发送聊天消息并触发 RAG/Agent 回答。
 */
async function sendChat() {
  const controller = getOrCreateChatController();
  if (controller) {
    await controller.sendChat();
    if (runtimeState.auth.user?.id) {
      await refreshChatSessions(true);
      renderChatSessionOptions();
    }
    return;
  }

  const input = document.getElementById("chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  appendMessage("user", text);
  appendMessage("ai", "RAG 组件未加载，当前使用降级模式。");
  input.value = "";
}

/**
 * 向聊天区追加一条消息。
 * @param {"user"|"ai"} role 消息角色。
 * @param {string} content 消息内容。
 */
function appendMessage(role, content) {
  const list = document.getElementById("chat-messages");
  if (!list) return;
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.innerHTML = `<div class="message-content">${escapeHtml(content)}</div>`;
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
}

/**
 * 渲染聊天面板的动态欢迎语（无消息时初始化一次）。
 */
function renderChatWelcomeMessage() {
  const list = document.getElementById("chat-messages");
  if (!list) return;
  if (list.children.length > 0) return;
  const file = appState.libraryFiles.find((item) => item.id === appState.activeFileId);
  const docName = file ? `《${file.name}》` : "当前学习资料";
  appendMessage("ai", `你好！我是你的文档智能助手。你可以围绕${docName}向我提问，我会优先基于当前页内容回答。`);
  syncChatModeTip();
}

/**
 * 清空聊天内容并重置欢迎语。
 * @param {boolean} withWelcome 是否立即渲染欢迎语。
 */
function clearChatMessages(withWelcome = true) {
  const list = document.getElementById("chat-messages");
  if (!list) return;
  list.innerHTML = "";
  if (withWelcome) {
    renderChatWelcomeMessage();
  }
}

/**
 * 同步聊天模式提示文本。
 */
function syncChatModeTip() {
  const tip = document.getElementById("chat-mode-tip");
  if (!tip) return;
  const status = getModelConfigStatus();
  if (status.ready) {
    tip.textContent = "当前模式：智能模型对话（后端转发）";
    return;
  }
  tip.textContent = status.enabled
    ? `当前模式：文档智能助手（模型未生效：${status.reason}）`
    : "当前模式：文档智能助手（未启用智能模型）";
}

/**
 * 更新首页统计卡片。
 */
function updateStats() {
  const today = toLocalDateString(new Date());
  const manual = getTodayManualTodos();
  const scheduleToday = getScheduleTasksForDate(today);
  const doneTodo = manual.filter((item) => item.done).length + scheduleToday.filter((item) => item.status === "done").length;
  const vocabCount = Object.values(appState.workspaceData)
    .reduce((sum, data) => sum + (Array.isArray(data?.vocab) ? data.vocab.length : 0), 0);
  setText("stat-files", String(appState.libraryFiles.length));
  setText("stat-vocab", String(vocabCount));
  setText("stat-notes", String(Object.values(appState.workspaceData).reduce((sum, data) => sum + (data.notes?.length || 0), 0)));
  setText("stat-tasks", String(doneTodo));
}

/**
 * 安全设置文本内容。
 * @param {string} id 元素 id。
 * @param {string} value 文本值。
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * HTML 转义函数。
 * @param {string} text 原始文本。
 * @returns {string} 转义文本。
 */
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 读取输入控件值并做 trim。
 * @param {string} id 元素 id。
 * @returns {string} 输入值。
 */
function getValue(id) {
  const el = document.getElementById(id);
  if (!el || typeof el.value !== "string") return "";
  return el.value.trim();
}

/**
 * 设置输入控件值。
 * @param {string} id 元素 id。
 * @param {string} value 目标值。
 */
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/**
 * 将日期归一化到当天零点。
 * @param {Date} date 日期对象。
 * @returns {Date} 零点时间。
 */
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 生成可持久化状态快照（本地与后端共用）。
 * @returns {Record<string, any>} 序列化后的状态。
 */
function buildPersistableState() {
  const isGuest = !runtimeState.auth.user?.id;
  return {
    themeMode: appState.themeMode,
    themeColor: appState.themeColor,
    autoSyncQuestionBank: appState.autoSyncQuestionBank,
    autoSyncMaxPerSave: appState.autoSyncMaxPerSave,
    librarySortBy: appState.librarySortBy,
    libraryStatusFilter: appState.libraryStatusFilter,
    libraryPageSize: appState.libraryPageSize,
    questionSourceFilter: appState.questionSourceFilter,
    llmEnabled: appState.llmEnabled,
    llmEndpoint: appState.llmEndpoint,
    llmModel: appState.llmModel,
    llmApiKey: appState.llmApiKey,
    llmTemperature: appState.llmTemperature,
    llmTopP: appState.llmTopP,
    llmMaxTokens: appState.llmMaxTokens,
    llmStream: appState.llmStream,
    llmSystemPrompt: appState.llmSystemPrompt,
    workspaceViewMode: appState.workspaceViewMode,
    workspacePdfZoom: appState.workspacePdfZoom,
    workspaceBrushMode: appState.workspaceBrushMode,
    workspaceBrushColor: appState.workspaceBrushColor,
    highlightColor: appState.highlightColor,
    highlightStyle: appState.highlightStyle,
    onboarding: isGuest ? { isNewUser: false, globalDone: false, pageSeen: {} } : appState.onboarding,
    selectedCalendarDate: appState.selectedCalendarDate,
    yearGoals: isGuest ? [] : appState.yearGoals,
    quarterGoals: isGuest ? [] : appState.quarterGoals,
    goalKrs: isGuest ? [] : appState.goalKrs,
    goalTaskLinks: isGuest ? [] : appState.goalTaskLinks,
    krTaskLinks: isGuest ? [] : appState.krTaskLinks,
    quarterReviews: isGuest ? [] : appState.quarterReviews,
    selectedGoalPeriod: isGuest ? "" : appState.selectedGoalPeriod,
    selectedQuarterGoalId: isGuest ? "" : appState.selectedQuarterGoalId,
    goalTaskSort: appState.goalTaskSort,
    notesPageSize: appState.notesPageSize,
    notesSort: appState.notesSort,
    selectedCategoryId: isGuest ? "" : appState.selectedCategoryId,
    activeFileId: isGuest ? "" : appState.activeFileId,
    collapsedCategoryIds: isGuest ? [] : appState.collapsedCategoryIds,
    libraryCategories: isGuest ? [] : appState.libraryCategories,
    libraryFiles: isGuest ? [] : appState.libraryFiles,
    workspaceData: isGuest ? {} : appState.workspaceData,
    todayTodos: isGuest ? [] : appState.todayTodos,
    todayTodosByDate: isGuest ? {} : appState.todayTodosByDate,
    scheduleTasks: isGuest ? [] : appState.scheduleTasks,
    learningRecords: isGuest ? [] : appState.learningRecords,
    questionBank: isGuest ? [] : appState.questionBank,
    questionCategories: isGuest ? [...DEFAULT_QUESTION_CATEGORIES] : appState.questionCategories,
  };
}

/**
 * 保存本地状态到 localStorage。
 */
function persistLocalState() {
  const payload = buildPersistableState();
  localStorage.setItem(getUserScopedStateStorageKey(), JSON.stringify(payload));
  snapshotTodayCompletion();
  scheduleBackendSync();
}

function getDailyCompletionKey(dateStr) {
  return getUserScopedStateStorageKey() + "_daily_" + dateStr;
}

function getBannerDismissedKey() {
  return getUserScopedStateStorageKey() + "_bannerDismissed";
}

/**
 * 将当日待办完成度写入 localStorage，供次日展示鼓励/赞扬用。
 */
function snapshotTodayCompletion() {
  const today = toLocalDateString(new Date());
  const scheduleTasks = getScheduleTasksForDate(today);
  const manual = getTodayManualTodos();
  const total = scheduleTasks.length + manual.length;
  const done = scheduleTasks.filter((t) => t.status === "done").length + manual.filter((t) => t.done).length;
  try {
    localStorage.setItem(getDailyCompletionKey(today), JSON.stringify({ total, done }));
  } catch {
    // ignore storage errors
  }
}

/**
 * 根据昨日完成度生成鼓励/赞扬文案；无昨日数据时提示安排今日任务。
 * @returns {{ text: string, variant: string }} 文案与样式变体（praise | encourage | plan）。
 */
function getDailyFeedbackContent() {
  const today = toLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);
  let raw = null;
  try {
    raw = localStorage.getItem(getDailyCompletionKey(yesterdayStr));
  } catch {
    // ignore
  }
  if (!raw) {
    return { text: "新的一天开始啦，安排一下今天要做的事吧～", variant: "plan" };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { text: "新的一天开始啦，安排一下今天要做的事吧～", variant: "plan" };
  }
  const total = Number(data.total) || 0;
  const done = Number(data.done) || 0;
  if (total === 0) {
    return { text: "昨天没有待办记录。今天不妨在日程里加几件小事，一步步完成～", variant: "plan" };
  }
  const rate = done / total;
  if (rate >= 1) {
    return { text: "昨天待办全部完成，太棒了！继续保持～", variant: "praise" };
  }
  if (rate >= 0.5) {
    return { text: `昨天完成了 ${done}/${total} 项待办，不错哦！今天也加油～`, variant: "encourage" };
  }
  return { text: `昨天还有一点没做完（${done}/${total}）。今天从一件小事开始吧～`, variant: "encourage" };
}

/**
 * 若今日未关闭过横幅，则展示昨日完成度反馈（鼓励/赞扬）或安排今日任务提示。
 */
function maybeShowDailyFeedbackBanner() {
  const dashboard = document.getElementById("page-dashboard");
  if (!dashboard?.classList.contains("active")) return;
  const today = toLocalDateString(new Date());
  try {
    if (localStorage.getItem(getBannerDismissedKey()) === today) return;
  } catch {
    return;
  }
  const banner = document.getElementById("daily-feedback-banner");
  const textEl = banner?.querySelector(".daily-feedback-text");
  if (!banner || !textEl) return;
  const { text, variant } = getDailyFeedbackContent();
  textEl.textContent = text;
  banner.className = "daily-feedback-banner daily-feedback-banner--" + variant;
  banner.setAttribute("aria-hidden", "false");
  banner.classList.remove("hidden");
}

/**
 * 关闭每日反馈横幅并记录今日已关闭，当日不再展示。
 */
function dismissDailyFeedbackBanner() {
  const today = toLocalDateString(new Date());
  try {
    localStorage.setItem(getBannerDismissedKey(), today);
  } catch {
    // ignore
  }
  const banner = document.getElementById("daily-feedback-banner");
  if (banner) {
    banner.classList.add("hidden");
    banner.setAttribute("aria-hidden", "true");
  }
}

window.dismissDailyFeedbackBanner = dismissDailyFeedbackBanner;

/**
 * 从 localStorage 恢复状态。
 */
function restoreLocalState() {
  const key = getUserScopedStateStorageKey();
  let raw = localStorage.getItem(key);
  if (!raw && runtimeState.auth.user?.id === "local-user") {
    const legacy = localStorage.getItem("clawmind-ui-state");
    if (legacy) {
      raw = legacy;
      localStorage.setItem(key, legacy);
      localStorage.removeItem("clawmind-ui-state");
    }
  }
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (typeof data.themeMode === "string" && data.themeMode === "light") appState.themeMode = "light";
    else appState.themeMode = "light";
    if (typeof data.themeColor === "string") appState.themeColor = data.themeColor;
    if (typeof data.autoSyncQuestionBank === "boolean") appState.autoSyncQuestionBank = data.autoSyncQuestionBank;
    if (typeof data.autoSyncMaxPerSave === "number") appState.autoSyncMaxPerSave = sanitizeCount(String(data.autoSyncMaxPerSave), 5, 20);
    if (typeof data.librarySortBy === "string") appState.librarySortBy = data.librarySortBy;
    if (typeof data.libraryStatusFilter === "string") appState.libraryStatusFilter = data.libraryStatusFilter;
    if (typeof data.libraryPageSize === "number") appState.libraryPageSize = sanitizeCount(String(data.libraryPageSize), 12, 24);
    if (typeof data.questionSourceFilter === "string") appState.questionSourceFilter = data.questionSourceFilter;
    if (typeof data.llmEnabled === "boolean") appState.llmEnabled = data.llmEnabled;
    if (typeof data.llmEndpoint === "string") appState.llmEndpoint = data.llmEndpoint;
    if (typeof data.llmModel === "string") appState.llmModel = data.llmModel;
    if (typeof data.llmApiKey === "string") appState.llmApiKey = data.llmApiKey;
    if (typeof data.llmTemperature === "number") appState.llmTemperature = sanitizeFloat(data.llmTemperature, 0.7, 0, 2);
    if (typeof data.llmTopP === "number") appState.llmTopP = sanitizeFloat(data.llmTopP, 1, 0, 1);
    if (typeof data.llmMaxTokens === "number") appState.llmMaxTokens = sanitizeCount(String(data.llmMaxTokens), 1024, 8192);
    if (typeof data.llmStream === "boolean") appState.llmStream = data.llmStream;
    if (typeof data.llmSystemPrompt === "string") appState.llmSystemPrompt = data.llmSystemPrompt;
    if (typeof data.workspaceViewMode === "string") {
      appState.workspaceViewMode = data.workspaceViewMode === "text" ? "text" : "original";
    }
    if (typeof data.workspacePdfZoom === "number") {
      appState.workspacePdfZoom = Math.max(40, Math.min(260, data.workspacePdfZoom));
    }
    if (typeof data.workspaceBrushMode === "string" && (data.workspaceBrushMode === "free" || data.workspaceBrushMode === "rect")) {
      appState.workspaceBrushMode = data.workspaceBrushMode;
    }
    if (typeof data.workspaceBrushColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(data.workspaceBrushColor)) {
      appState.workspaceBrushColor = data.workspaceBrushColor;
    }
    if (typeof data.highlightColor === "string" && HIGHLIGHT_COLORS[data.highlightColor]) {
      appState.highlightColor = data.highlightColor;
    }
    if (typeof data.highlightStyle === "string" && HIGHLIGHT_STYLES[data.highlightStyle]) {
      appState.highlightStyle = data.highlightStyle;
    }
    if (data.onboarding && typeof data.onboarding === "object") {
      appState.onboarding.isNewUser = Boolean(data.onboarding.isNewUser);
      appState.onboarding.globalDone = Boolean(data.onboarding.globalDone);
      appState.onboarding.pageSeen = (data.onboarding.pageSeen && typeof data.onboarding.pageSeen === "object")
        ? data.onboarding.pageSeen
        : {};
    }
    if (typeof data.selectedCategoryId === "string") appState.selectedCategoryId = data.selectedCategoryId;
    if (typeof data.selectedCalendarDate === "string") appState.selectedCalendarDate = data.selectedCalendarDate;
    if (typeof data.activeFileId === "string") appState.activeFileId = data.activeFileId;
    if (typeof data.notesPageSize === "number") appState.notesPageSize = sanitizeCount(String(data.notesPageSize), 10, 16);
    if (typeof data.notesSort === "string") appState.notesSort = data.notesSort === "oldest" ? "oldest" : "newest";
    if (Array.isArray(data.yearGoals)) appState.yearGoals = data.yearGoals;
    if (Array.isArray(data.quarterGoals)) appState.quarterGoals = data.quarterGoals;
    if (Array.isArray(data.goalKrs)) appState.goalKrs = data.goalKrs;
    if (Array.isArray(data.goalTaskLinks)) appState.goalTaskLinks = data.goalTaskLinks;
    if (Array.isArray(data.krTaskLinks)) appState.krTaskLinks = data.krTaskLinks;
    if (Array.isArray(data.quarterReviews)) appState.quarterReviews = data.quarterReviews;
    if (typeof data.selectedGoalPeriod === "string") appState.selectedGoalPeriod = data.selectedGoalPeriod;
    if (typeof data.selectedQuarterGoalId === "string") appState.selectedQuarterGoalId = data.selectedQuarterGoalId;
    if (typeof data.goalTaskSort === "string") appState.goalTaskSort = data.goalTaskSort;
    if (Array.isArray(data.collapsedCategoryIds)) appState.collapsedCategoryIds = data.collapsedCategoryIds;
    if (Array.isArray(data.libraryCategories)) appState.libraryCategories = data.libraryCategories;
    if (Array.isArray(data.libraryFiles)) appState.libraryFiles = data.libraryFiles;
  if (data.workspaceData && typeof data.workspaceData === "object") appState.workspaceData = data.workspaceData;
  if (Array.isArray(data.todayTodos)) appState.todayTodos = data.todayTodos;
  if (data.todayTodosByDate && typeof data.todayTodosByDate === "object") {
    appState.todayTodosByDate = data.todayTodosByDate;
  }
  if (Array.isArray(data.scheduleTasks)) appState.scheduleTasks = data.scheduleTasks;
    if (Array.isArray(data.learningRecords)) appState.learningRecords = data.learningRecords;
    if (Array.isArray(data.questionBank)) appState.questionBank = data.questionBank;
    if (Array.isArray(data.questionCategories)) appState.questionCategories = data.questionCategories;
    normalizeQuestionBankItems();
    normalizeQuestionCategories();
  } catch {
    localStorage.removeItem(key);
  }
}

window.navigateTo = navigateTo;
window.showAddTodo = showAddTodo;
window.submitTodoModal = submitTodoModal;
window.refreshDailyQuote = refreshDailyQuote;
window.showUploadModal = showUploadModal;
window.uploadFile = uploadFile;
window.closeModal = closeModal;
window.showNewCategory = showNewCategory;
window.submitNewCategory = submitNewCategory;
window.renameCurrentCategory = renameCurrentCategory;
window.submitRenameCategoryModal = submitRenameCategoryModal;
window.deleteCurrentCategory = deleteCurrentCategory;
window.changeLibraryPage = changeLibraryPage;
window.toggleLibrarySelection = toggleLibrarySelection;
window.selectAllLibraryFiles = selectAllLibraryFiles;
window.clearLibrarySelection = clearLibrarySelection;
window.deleteSelectedLibraryFiles = deleteSelectedLibraryFiles;
window.toggleSelectFile = toggleSelectFile;
window.handleAuthAction = handleAuthAction;
window.toggleAuthMode = toggleAuthMode;
window.submitAuthModal = submitAuthModal;
window.openDocument = openDocument;
window.analyzeDoc = analyzeDoc;
window.deleteFile = deleteFile;
window.showTaskPlanModal = showTaskPlanModal;
window.submitTaskPlan = submitTaskPlan;
window.deleteTaskPlan = deleteTaskPlan;
window.changeRandomPage = changeRandomPage;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.changeTaskPage = changeTaskPage;
window.changeTaskPageSize = changeTaskPageSize;
window.changeNotesPage = changeNotesPage;
window.changeNotesPageSize = changeNotesPageSize;
window.handleNotesSearch = handleNotesSearch;
window.changeNotesSort = changeNotesSort;
window.toggleNotesSelection = toggleNotesSelection;
window.selectAllNotes = selectAllNotes;
window.clearNotesSelection = clearNotesSelection;
window.deleteSelectedNotes = deleteSelectedNotes;
window.changeVocabPage = changeVocabPage;
window.changeVocabPageSize = changeVocabPageSize;
window.openYearGoalModal = openYearGoalModal;
window.submitYearGoalModal = submitYearGoalModal;
window.openQuarterGoalModal = openQuarterGoalModal;
window.submitQuarterGoalModal = submitQuarterGoalModal;
window.openKrModal = openKrModal;
window.submitKrModal = submitKrModal;
window.submitKrTaskModal = submitKrTaskModal;
window.changeGoalPeriod = changeGoalPeriod;
window.openGoalTaskModal = openGoalTaskModal;
window.submitGoalTaskModal = submitGoalTaskModal;
window.saveQuarterReview = saveQuarterReview;
window.showQuestionBankModal = showQuestionBankModal;
window.showAddQuestionCategoryPrompt = showAddQuestionCategoryPrompt;
window.submitQuestionCategoryModal = submitQuestionCategoryModal;
window.openQuestionCategoryEditModal = openQuestionCategoryEditModal;
window.submitQuestionCategoryEdit = submitQuestionCategoryEdit;
window.deleteQuestionCategory = deleteQuestionCategory;
window.showQuestionBatchImportModal = showQuestionBatchImportModal;
window.submitQuestionBankItem = submitQuestionBankItem;
window.submitQuestionBatchImport = submitQuestionBatchImport;
window.drawRandomQuestions = drawRandomQuestions;
window.renderAllByCount = renderAllByCount;
window.toggleVibeMode = toggleVibeMode;
window.playLofi = playLofi;
window.stopLofi = stopLofi;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.zoomWorkspaceOut = zoomWorkspaceOut;
window.zoomWorkspaceIn = zoomWorkspaceIn;
window.resetWorkspaceZoom = resetWorkspaceZoom;
window.setHighlightColor = setHighlightColor;
window.setHighlightStyle = setHighlightStyle;
window.sendChat = sendChat;
window.clearChatMessages = clearChatMessages;
window.switchChatSession = switchChatSession;
window.createNewChatSession = createNewChatSession;
window.deleteCurrentChatSession = deleteCurrentChatSession;
window.saveModelSettings = saveModelSettings;
window.applyHighlightFromSelection = applyHighlightFromSelection;
window.captureSelectionAsNote = captureSelectionAsNote;
window.addManualNote = addManualNote;
window.addSelectionToVocab = addSelectionToVocab;
window.addCustomVocab = addCustomVocab;
window.submitVocabModal = submitVocabModal;
window.confirmAppDialog = confirmAppDialog;
window.cancelAppDialog = cancelAppDialog;
window.toggleLearningComplete = toggleLearningComplete;
window.saveWorkspaceProgress = saveWorkspaceProgress;
window.extractArticleToQuestionBank = extractArticleToQuestionBank;
window.confirmExtractToQuestionBank = confirmExtractToQuestionBank;
window.toggleExtractKind = toggleExtractKind;
window.onboardingPrev = onboardingPrev;
window.onboardingNext = onboardingNext;
window.onboardingSkip = onboardingSkip;

document.addEventListener("DOMContentLoaded", initApp);
