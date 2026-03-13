window.ClawMindConfig = {
  "deploymentMode": "local-lan",
  "apiBaseUrl": (() => {
    const origin = window.location.origin;
    if (origin && origin !== "null" && !origin.startsWith("file:")) {
      return `${origin}/api`;
    }
    return "http://127.0.0.1:8788/api";
  })(),
  "generatedAt": "2026-03-09T08:51:08.846Z"
};
