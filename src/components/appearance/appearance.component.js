(function registerAppearanceComponent() {
  /**
   * 将十六进制颜色转换为 RGBA 字符串。
   * @param {string} hex 十六进制颜色值。
   * @param {number} alpha 透明度。
   * @returns {string} RGBA 字符串。
   */
  function hexToRgba(hex, alpha) {
    const pure = String(hex || "").replace("#", "");
    if (pure.length !== 6) return "rgba(233,69,96,0.15)";
    const r = Number.parseInt(pure.slice(0, 2), 16);
    const g = Number.parseInt(pure.slice(2, 4), 16);
    const b = Number.parseInt(pure.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 应用主题色到 CSS 变量。
   * @param {string} colorHex 主色值。
   */
  function applyThemeColor(colorHex) {
    const root = document.documentElement;
    root.style.setProperty("--primary", colorHex);
    root.style.setProperty("--primary-soft", hexToRgba(colorHex, 0.15));
  }

  /**
   * 应用外观模式到 body 属性。
   * @param {"dark"|"light"} mode 外观模式。
   */
  function applyThemeMode(mode) {
    document.body.dataset.theme = mode;
  }

  /**
   * 同步主题色选中态到设置色板。
   * @param {string} currentColor 当前主题色。
   */
  function syncThemeOptionActive(currentColor) {
    const options = document.querySelectorAll(".color-option");
    options.forEach((option) => {
      const active = (option.dataset.color || "").toLowerCase() === String(currentColor || "").toLowerCase();
      option.classList.toggle("active", active);
    });
  }

  /**
   * 绑定主题色点击事件。
   * @param {{themeColor:string}} state 应用状态对象。
   * @param {(key:string, value:any)=>void} onStateChange 状态变更回调。
   * @param {()=>void} onPersist 持久化回调。
   */
  function bindThemeColorPicker(state, onStateChange, onPersist) {
    const options = document.querySelectorAll(".color-option");
    if (options.length === 0) return;
    options.forEach((option) => {
      option.addEventListener("click", () => {
        const color = option.dataset.color || "";
        if (!color) return;
        onStateChange("themeColor", color);
        applyThemeColor(color);
        syncThemeOptionActive(color);
        onPersist();
      });
    });
    syncThemeOptionActive(state.themeColor);
  }

  /**
   * 绑定暗色/白天模式切换事件。
   * @param {{themeMode:string}} state 应用状态对象。
   * @param {(key:string, value:any)=>void} onStateChange 状态变更回调。
   * @param {()=>void} onPersist 持久化回调。
   */
  function bindAppearanceModeToggle(state, onStateChange, onPersist) {
    const toggle = document.getElementById("appearance-mode-toggle");
    if (!toggle) return;
    toggle.checked = state.themeMode === "dark";
    toggle.addEventListener("change", () => {
      const mode = toggle.checked ? "dark" : "light";
      onStateChange("themeMode", mode);
      applyThemeMode(mode);
      onPersist();
    });
  }

  window.ClawMindAppearance = {
    hexToRgba,
    applyThemeColor,
    applyThemeMode,
    syncThemeOptionActive,
    bindThemeColorPicker,
    bindAppearanceModeToggle,
  };
})();
