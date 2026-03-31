export function logTool(tool: string) {
  fetch("/api/log-tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool }),
  }).catch(() => {});
}
