(function registerChatComponent() {
  /**
     * 将纯文本安全转换为 HTML（保留换行）。
     * 优先使用 marked 进行 Markdown 渲染。
     * @param {(text:string)=>string} escapeHtml HTML 转义函数。
     * @param {string} content 原始文本。
     * @returns {string} 可注入 HTML 字符串。
     */
    function toSafeMultilineHtml(escapeHtml, content) {
      if (typeof window.marked !== "undefined" && typeof window.marked.parse === "function") {
        try {
          return window.marked.parse(content);
        } catch (e) {
          console.warn("Markdown parse failed, fallback to plain text", e);
        }
      }
      return escapeHtml(content).replace(/\n/g, "<br>");
    }

  /**
   * 构建 AI 回答消息中的“加入题库”操作区。
   * @param {{
   *   getQuestionCategories:()=>string[],
   *   addToQuestionBank:(payload:{category:string,content:string,answer:string,source:string})=>{added:boolean,message:string}
   * }} options 组件运行依赖。
   * @param {string} query 用户提问内容。
   * @param {string} answer AI 回答内容。
   * @param {"remote"|"local"} source 回答来源。
   * @returns {HTMLElement} 操作区元素。
   */
  function createQuestionBankActions(options, query, answer, source) {
    const wrap = document.createElement("div");
    wrap.className = "message-actions";

    const select = document.createElement("select");
    select.className = "chat-mini-select";
    const categories = options.getQuestionCategories();
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-mini-btn";
    btn.textContent = "加入题库";

    const tip = document.createElement("span");
    tip.className = "chat-inline-tip";
    tip.textContent = "可将当前问答沉淀到随机题库";

    btn.addEventListener("click", () => {
      const result = options.addToQuestionBank({
        category: select.value,
        content: query,
        answer,
        source: source === "remote" ? "rag-remote" : "rag-local",
      });
      tip.textContent = result.message;
      tip.classList.toggle("ok", result.added);
      tip.classList.toggle("warn", !result.added);
    });

    wrap.appendChild(select);
    wrap.appendChild(btn);
    wrap.appendChild(tip);
    return wrap;
  }

  /**
   * 创建聊天控制器，封装消息渲染与 RAG 问答调用。
   * @param {{
   *   getInputElement:()=>HTMLInputElement|null,
   *   getMessageListElement:()=>HTMLElement|null,
   *   escapeHtml:(text:string)=>string,
   *   buildRagContext:()=>any,
   *   getRagEndpoint:()=>string,
   *   askCustomModel?:(query:string,context:any)=>Promise<{answer:string,sourceTag?:string}|null>,
   *   getModelConfigStatus?:()=>{enabled:boolean,ready:boolean,reason:string},
   *   getLastModelError?:()=>string,
   *   askBackendRag?:(query:string,context:any)=>Promise<{answer:string,references:string[],source:"remote"|"local"}|null>,
   *   getQuestionCategories:()=>string[],
   *   addToQuestionBank:(payload:{category:string,content:string,answer:string,source:string})=>{added:boolean,message:string}
   * }} options 组件运行依赖。
   * @returns {{sendChat:()=>Promise<void>,appendMessage:(role:"user"|"ai",content:string)=>void}} 控制器对象。
   */
  function createChatController(options) {
    /**
     * 异步等待指定毫秒数。
     * @param {number} ms 等待时长（毫秒）。
     * @returns {Promise<void>} 等待结果。
     */
    function sleep(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    /**
     * 返回当前时间标签文本。
     * @returns {string} 时间字符串。
     */
    function getNowTimeLabel() {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    /**
     * 渲染一条聊天消息。
     * @param {"user"|"ai"} role 消息角色。
     * @param {string} content 消息内容。
     * @param {string} sourceTag 来源标签。
     */
    function appendMessage(role, content, sourceTag = "") {
      const list = options.getMessageListElement();
      if (!list) return;
      const item = document.createElement("div");
      item.className = `message ${role}`;
      const escaped = toSafeMultilineHtml(options.escapeHtml, content);
      item.innerHTML = `
        <div class="message-bubble">
          <div class="message-content">${escaped}</div>
          <div class="message-meta">
            <span>${role === "user" ? "你" : "AI"}</span>
            <span>${getNowTimeLabel()}</span>
            ${sourceTag ? `<span>${options.escapeHtml(sourceTag)}</span>` : ""}
          </div>
        </div>
      `;
      list.appendChild(item);
      list.scrollTop = list.scrollHeight;
    }

    /**
     * 追加一条 AI 流式消息并返回更新控制句柄。
     * @param {string} sourceTag 来源标签文本。
     * @returns {{write:(next:string)=>void,finish:()=>void}} 写入控制器。
     */
    function createStreamingAiMessage(sourceTag = "") {
      const list = options.getMessageListElement();
      if (!list) {
        return {
          write: () => {},
          finish: () => {},
        };
      }
      const item = document.createElement("div");
      item.className = "message ai";
      item.innerHTML = `
        <div class="message-bubble">
          <div class="message-content"><span class="assistant-loading">AI 正在思考</span></div>
          <div class="message-meta">
            <span>AI</span>
            <span>${getNowTimeLabel()}</span>
            ${sourceTag ? `<span>${options.escapeHtml(sourceTag)}</span>` : ""}
          </div>
        </div>
      `;
      const contentEl = item.querySelector(".message-content");
      list.appendChild(item);
      list.scrollTop = list.scrollHeight;
      return {
        write: (next) => {
          if (!contentEl) return;
          contentEl.innerHTML = toSafeMultilineHtml(options.escapeHtml, next);
          list.scrollTop = list.scrollHeight;
        },
        finish: () => {
          list.scrollTop = list.scrollHeight;
        },
      };
    }

    /**
     * 以打字机方式渲染 AI 回复，提升对话反馈速度感。
     * @param {string} text 完整文本。
     * @param {string} sourceTag 来源标签。
     * @returns {Promise<void>} 渲染流程。
     */
    async function appendStreamAiMessage(text, sourceTag = "") {
      const stream = createStreamingAiMessage(sourceTag);
      const sourceText = String(text || "");
      if (!sourceText) {
        stream.write("（空响应）");
        stream.finish();
        return;
      }
      const len = sourceText.length;
      const step = len > 900 ? 18 : len > 300 ? 10 : 5;
      for (let index = 0; index < len; index += step) {
        stream.write(sourceText.slice(0, Math.min(len, index + step)));
        await sleep(16);
      }
      stream.finish();
    }

    /**
     * 追加带“加入题库”操作区的 AI 回答消息。
     * @param {string} query 用户提问内容。
     * @param {string} answer AI 回答正文。
     * @param {string[]} refs 参考片段数组。
     * @param {"remote"|"local"} source 回答来源。
     */
    function appendRagAnswerMessage(query, answer, refs, source) {
      const list = options.getMessageListElement();
      if (!list) return;

      const sourceText = source === "remote" ? "（远端RAG）" : "（本地RAG）";
      const refText = refs.length > 0 ? `\n\n参考片段：\n- ${refs.join("\n- ")}` : "";
      const fullText = `${answer}\n\n数据来源：${sourceText}${refText}`;

      const item = document.createElement("div");
      item.className = "message ai";
      const contentNode = document.createElement("div");
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      contentNode.className = "message-content";
      contentNode.innerHTML = toSafeMultilineHtml(options.escapeHtml, fullText);
      bubble.appendChild(contentNode);

      const actions = createQuestionBankActions(options, query, answer, source);
      bubble.appendChild(actions);

      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.innerHTML = `<span>AI</span><span>${getNowTimeLabel()}</span><span>${source === "remote" ? "远端RAG" : "本地RAG"}</span>`;
      bubble.appendChild(meta);
      item.appendChild(bubble);
      list.appendChild(item);
      list.scrollTop = list.scrollHeight;
    }

    /**
     * 渲染历史消息列表（会话回放）。
     * @param {Array<{role:string,content:string,references?:string[]}>} messages 历史消息。
     */
    function renderHistory(messages) {
      const list = options.getMessageListElement();
      if (!list) return;
      list.innerHTML = "";
      let lastUserQuery = "";
      (Array.isArray(messages) ? messages : []).forEach((item) => {
        const role = String(item?.role || "");
        const content = String(item?.content || "");
        if (!content) return;
        if (role === "user") {
          lastUserQuery = content;
          appendMessage("user", content);
          return;
        }
        if (role === "assistant") {
          const refs = Array.isArray(item?.references) ? item.references : [];
          appendRagAnswerMessage(lastUserQuery || "历史问题", content, refs, "remote");
          return;
        }
        appendMessage("ai", content);
      });
    }

    /**
     * 发送消息并触发 RAG 回答。
     * @returns {Promise<void>} 异步流程。
     */
    async function sendChat() {
      const input = options.getInputElement();
      if (!input) return;
      const query = String(input.value || "").trim();
      if (!query) return;

      appendMessage("user", query);
      input.value = "";
      input.disabled = true;
      const oldPlaceholder = input.placeholder;
      input.placeholder = "AI 正在检索当前文档...";

      try {
        const context = options.buildRagContext();

        const modelStatus = typeof options.getModelConfigStatus === "function"
          ? options.getModelConfigStatus()
          : { enabled: false, ready: false, reason: "" };

        // 优先使用流式对话接口
        if (typeof options.askStreamChat === "function" && modelStatus.enabled && modelStatus.ready) {
          const stream = createStreamingAiMessage("智能助手");
          let fullAnswer = "";
          try {
            await options.askStreamChat(query, context, (chunk) => {
              fullAnswer += chunk;
              stream.write(fullAnswer);
            });
            stream.finish();
            return;
          } catch (err) {
            console.error(err);
            stream.write(fullAnswer + `\n[系统提示] 对话异常中断：${err.message}`);
            stream.finish();
          }
        }

        if (modelStatus.enabled && !modelStatus.ready) {
          const reason = typeof options.getLastModelError === "function"
            ? String(options.getLastModelError() || modelStatus.reason || "模型调用失败")
            : String(modelStatus.reason || "模型调用失败");
          appendMessage("ai", `智能模型未生效，已回退到RAG。\n原因：${reason}`, "系统提示");
        }

        if (modelStatus.enabled && typeof options.askCustomModel === "function") {
          const customResult = await options.askCustomModel(query, context);
          if (customResult && typeof customResult.answer === "string") {
            await appendStreamAiMessage(customResult.answer, String(customResult.sourceTag || "LangGraph Agent"));
            return;
          }
        }
        if (typeof options.askBackendRag === "function") {
          const backendResult = await options.askBackendRag(query, context);
          if (backendResult) {
            const refs = Array.isArray(backendResult.references) ? backendResult.references : [];
            appendRagAnswerMessage(query, backendResult.answer, refs, backendResult.source);
            return;
          }
        }
        const ragService = window.ClawMindRagService;
        if (!ragService || typeof ragService.askQuestion !== "function") {
          appendMessage("ai", "RAG 服务未就绪，请刷新页面后重试。");
          return;
        }
        const result = await ragService.askQuestion(query, context, {
          endpoint: options.getRagEndpoint(),
        });
        const refs = Array.isArray(result.references) ? result.references : [];
        appendRagAnswerMessage(query, result.answer, refs, result.source);
      } catch {
        appendMessage("ai", "处理问题时出现异常，请稍后重试。");
      } finally {
        input.disabled = false;
        input.placeholder = oldPlaceholder;
        input.focus();
      }
    }

    return {
      sendChat,
      appendMessage,
      renderHistory,
    };
  }

  window.ClawMindChat = {
    createChatController,
  };
})();
