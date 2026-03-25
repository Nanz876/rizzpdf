export function logTool(tool: string, userId?: string) {
  fetch("/api/log-tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, userId }),
  }).catch(() => {});
}
