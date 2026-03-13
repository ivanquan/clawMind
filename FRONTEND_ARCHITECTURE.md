# ClawMind 前端组件化规范（第一阶段）

## 1. 目标

- 从 `app.js` 单文件模式，逐步迁移到「组件 + 服务 + 状态」分层结构。
- 新增能力（如 RAG 对话）必须优先放在组件目录，避免继续堆积到主文件。
- 保证迁移期间功能可用、可回滚、可渐进替换。

## 2. 目录约定

```text
src/
  components/
    appearance/
      appearance.component.js
    chat/
      chat.component.js
    library/
      library.component.js
  services/
    rag/
      rag.service.js
```

## 3. 组件职责

- `appearance.component.js`
  - 负责主题色、深浅色模式、外观控件绑定。
  - 对外暴露 `window.ClawMindAppearance`。
- `library.component.js`
  - 负责学习状态计算、徽标输出、图书馆排序筛选。
  - 对外暴露 `window.ClawMindLibrary`。
- `chat.component.js`
  - 负责聊天消息渲染、发送态管理、RAG 调用编排。
  - 对外暴露 `window.ClawMindChat`。
- `rag.service.js`
  - 负责检索片段构建、本地检索回答、远端接口兜底调用。
  - 对外暴露 `window.ClawMindRagService`。

## 4. 接口约束

- 所有组件方法保持纯函数优先，避免直接依赖全局状态。
- 与主流程对接时，通过参数传入 `state` 和回调，不在组件内写死 `appState`。
- 每个函数必须有中文注释，说明输入、输出、行为。

## 5. 迁移策略

- 第一阶段：抽离纯逻辑（外观、排序筛选）。
- 第二阶段：抽离交互组件（任务弹窗、题库、工作区标注、聊天问答）。
- 第三阶段：抽离数据服务（localStorage、IndexedDB、RAG API）。

## 6. 下一步开发建议

- 新建 `src/services/rag/rag.service.js`，实现文档问答的最小可用接口（先 mock，再接真实 API）。
- 新建 `src/components/chat/chat.component.js`，将工作区 AI 对话从 `app.js` 中迁出。
