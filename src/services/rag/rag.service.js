(function registerRagService() {
  /**
   * 将文本做标准化，便于统一检索评分。
   * @param {string} text 原始文本。
   * @returns {string} 标准化文本。
   */
  function normalizeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * 将用户问题切分为检索 token。
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
   * 将 HTML 片段转为纯文本，避免把标签带入检索。
   * @param {string} html HTML 字符串。
   * @returns {string} 纯文本。
   */
  function htmlToPlainText(html) {
    const temp = document.createElement("div");
    temp.innerHTML = String(html || "");
    return normalizeText(temp.textContent || "");
  }

  /**
   * 裁剪文本长度，避免回答中过长片段影响可读性。
   * @param {string} text 原始文本。
   * @param {number} max 最大长度。
   * @returns {string} 裁剪后的文本。
   */
  function truncateText(text, max) {
    const value = String(text || "").trim();
    if (!value) return "";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  /**
   * 计算单个片段与问题 token 的匹配分值。
   * @param {string[]} queryTokens 问题 token。
   * @param {string} chunkText 片段文本。
   * @returns {number} 匹配分。
   */
  function scoreChunk(queryTokens, chunkText) {
    if (!Array.isArray(queryTokens) || queryTokens.length === 0) return 0;
    const normalized = normalizeText(chunkText);
    if (!normalized) return 0;
    let score = 0;
    queryTokens.forEach((token) => {
      if (!token) return;
      if (normalized.includes(token)) {
        score += token.length >= 4 ? 3 : 2;
      }
    });
    return score;
  }

  /**
   * 从工作区上下文生成可检索片段集合。
   * @param {{
   *   fileName:string,
   *   currentPage:number,
   *   pages:Array<{html?:string,text?:string,highlights?:Array<{text?:string}>}>,
   *   notes:Array<{text?:string}>
   * }} context 当前文档上下文。
   * @returns {Array<{id:string,type:string,text:string,meta:string}>} 片段集合。
   */
  function buildChunks(context) {
    const chunks = [];
    const pages = Array.isArray(context?.pages) ? context.pages : [];
    const notes = Array.isArray(context?.notes) ? context.notes : [];
    const currentPage = Number(context?.currentPage || 1);

    pages.forEach((page, index) => {
      const text = page?.text ? normalizeText(page.text) : htmlToPlainText(page?.html || "");
      if (text) {
        chunks.push({
          id: `page-${index + 1}`,
          type: "page",
          text,
          meta: `第 ${index + 1} 页`,
        });
      }
      const highs = Array.isArray(page?.highlights) ? page.highlights : [];
      highs.forEach((item, hIndex) => {
        const highText = normalizeText(item?.text || "");
        if (!highText) return;
        chunks.push({
          id: `highlight-${index + 1}-${hIndex + 1}`,
          type: "highlight",
          text: highText,
          meta: `第 ${index + 1} 页高亮`,
        });
      });
    });

    notes.forEach((note, index) => {
      const text = normalizeText(note?.text || "");
      if (!text) return;
      chunks.push({
        id: `note-${index + 1}`,
        type: "note",
        text,
        meta: "学习笔记",
      });
    });

    const boosted = chunks.map((chunk) => {
      const fromPage = chunk.type === "page" || chunk.type === "highlight";
      const isCurrent = fromPage && chunk.meta.startsWith(`第 ${currentPage} 页`);
      return {
        ...chunk,
        boost: isCurrent ? 2 : 0,
      };
    });

    return boosted;
  }

  /**
   * 使用本地检索结果生成回答（MVP 版本）。
   * @param {string} query 用户问题。
   * @param {Array<{id:string,type:string,text:string,meta:string,boost?:number}>} chunks 检索片段。
   * @returns {{answer:string,references:string[],confidence:"low"|"medium"}} 回答结果。
   */
  function buildLocalAnswer(query, chunks) {
    const queryTokens = tokenizeQuery(query);
    const scored = chunks
      .map((chunk) => ({
        ...chunk,
        score: scoreChunk(queryTokens, chunk.text) + Number(chunk.boost || 0),
      }))
      .sort((a, b) => b.score - a.score);

    const matched = scored.filter((item) => item.score > 0).slice(0, 3);
    const top = matched.length > 0 ? matched : scored.slice(0, 2);

    if (top.length === 0) {
      return {
        answer: "当前文档没有可用内容，建议先在工作区打开文档并进行学习记录后再提问。",
        references: [],
        confidence: "low",
      };
    }

    const references = top.map((item) => `${item.meta}：${truncateText(item.text, 90)}`);
    const answerLines = top.map((item, index) => `${index + 1}. ${truncateText(item.text, 120)}`);
    const answer = [
      "基于当前文档与学习记录，我给你一个可直接复习的回答：",
      ...answerLines,
      "如果你愿意，我可以继续把这部分转成“随机题库”条目。",
    ].join("\n");

    return {
      answer,
      references,
      confidence: matched.length > 0 ? "medium" : "low",
    };
  }

  /**
   * 当配置了远端 RAG 接口时，调用接口获取回答。
   * @param {string} endpoint 接口地址。
   * @param {{query:string,fileName:string,chunks:Array<any>}} payload 请求体。
   * @returns {Promise<{answer:string,references?:string[]}|null>} 远端结果。
   */
  async function askRemote(endpoint, payload) {
    if (!endpoint) return null;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data.answer !== "string") return null;
      return {
        answer: data.answer,
        references: Array.isArray(data.references) ? data.references : [],
      };
    } catch {
      return null;
    }
  }

  /**
   * 对外暴露的 RAG 问答入口：优先尝试远端接口，失败时回退本地检索回答。
   * @param {string} query 用户问题。
   * @param {{
   *   fileName:string,
   *   currentPage:number,
   *   pages:Array<{html?:string,text?:string,highlights?:Array<{text?:string}>}>,
   *   notes:Array<{text?:string}>
   * }} context 上下文。
   * @param {{endpoint?:string}} options 额外配置。
   * @returns {Promise<{answer:string,references:string[],source:"remote"|"local"}>} 问答结果。
   */
  async function askQuestion(query, context, options) {
    const chunks = buildChunks(context);
    const payload = {
      query: String(query || "").trim(),
      fileName: String(context?.fileName || ""),
      chunks: chunks.map((item) => ({
        id: item.id,
        type: item.type,
        text: item.text,
        meta: item.meta,
      })),
    };

    const endpoint = String(options?.endpoint || "").trim();
    const remote = await askRemote(endpoint, payload);
    if (remote) {
      return {
        answer: remote.answer,
        references: Array.isArray(remote.references) ? remote.references : [],
        source: "remote",
      };
    }

    const local = buildLocalAnswer(query, chunks);
    return {
      answer: local.answer,
      references: local.references,
      source: "local",
    };
  }

  window.ClawMindRagService = {
    askQuestion,
    buildChunks,
  };
})();
