/**
 * 解析 OpenAI 兼容 endpoint，提取 baseURL。
 * @param {string} endpoint 完整接口地址。
 * @returns {string} 适配后的 baseURL。
 */
function normalizeOpenAiBaseUrl(endpoint) {
  const text = String(endpoint || "").trim().replace(/\/+$/, "");
  if (text.endsWith("/chat/completions")) {
    return text.slice(0, -"/chat/completions".length);
  }
  return text;
}

/**
 * 将模型返回内容统一转换为纯文本。
 * @param {any} message 模型返回消息对象。
 * @returns {string} 纯文本回答。
 */
function normalizeModelMessageContent(message) {
  const value = message?.content;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * 惰性加载 LangGraph 相关模块并缓存。
 * @returns {Promise<any>} 运行时模块集合。
 */
async function loadLangGraphRuntime() {
  const [{ StateGraph, Annotation, START, END }, { ChatOpenAI }] = await Promise.all([
    import("@langchain/langgraph"),
    import("@langchain/openai"),
  ]);
  return { StateGraph, Annotation, START, END, ChatOpenAI };
}

/**
 * 使用 LangGraph 构建并执行最小 Agent 流程。
 * @param {{endpoint:string,apiKey:string,model:string,query:string,contextText:string}} input 输入参数。
 * @returns {Promise<{ok:boolean,answer:string}>} 执行结果。
 */
async function invokeLangGraphAgent(input) {
  const runtime = await loadLangGraphRuntime();
  const AgentState = runtime.Annotation.Root({
    endpoint: runtime.Annotation({ default: () => "" }),
    apiKey: runtime.Annotation({ default: () => "" }),
    model: runtime.Annotation({ default: () => "" }),
    query: runtime.Annotation({ default: () => "" }),
    contextText: runtime.Annotation({ default: () => "" }),
    retrievedContext: runtime.Annotation({ default: () => "" }),
    answer: runtime.Annotation({ default: () => "" }),
  });

  /**
   * 工具节点：统一整理上下文，模拟 Agent 的检索工具步骤。
   * @param {any} state 当前图状态。
   * @returns {{retrievedContext:string}} 检索结果。
   */
  const retrieveContextNode = async (state) => {
    const raw = String(state.contextText || "").trim();
    if (!raw) {
      return { retrievedContext: "" };
    }
    // 控制上下文长度，避免 token 爆炸导致模型超时。
    return { retrievedContext: raw.slice(0, 8000) };
  };

  /**
   * 模型节点：基于工具节点产物进行最终回答。
   * @param {any} state 当前图状态。
   * @returns {Promise<{answer:string}>} 回答结果。
   */
  const callModelNode = async (state) => {
    const llm = new runtime.ChatOpenAI({
      model: String(state.model || "").trim(),
      apiKey: String(state.apiKey || "").trim(),
      temperature: 0.2,
      configuration: {
        baseURL: normalizeOpenAiBaseUrl(state.endpoint),
      },
    });
    const prompt = state.retrievedContext
      ? `学习上下文如下：\n${state.retrievedContext}\n\n用户问题：${state.query}`
      : state.query;
    const response = await llm.invoke([
      ["system", "你是一个中文学习助手，请基于上下文给出简洁、可执行的回答。"],
      ["user", prompt],
    ]);
    return {
      answer: normalizeModelMessageContent(response),
    };
  };

  const graph = new runtime.StateGraph(AgentState)
    .addNode("retrieveContext", retrieveContextNode)
    .addNode("callModel", callModelNode)
    .addEdge(runtime.START, "retrieveContext")
    .addEdge("retrieveContext", "callModel")
    .addEdge("callModel", runtime.END)
    .compile();

  const result = await graph.invoke({
    endpoint: String(input.endpoint || "").trim(),
    apiKey: String(input.apiKey || "").trim(),
    model: String(input.model || "").trim(),
    query: String(input.query || "").trim(),
    contextText: String(input.contextText || "").trim(),
  });

  return {
    ok: true,
    answer: String(result?.answer || "").trim(),
  };
}

module.exports = {
  invokeLangGraphAgent,
};
