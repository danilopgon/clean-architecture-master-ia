export function checkHealth(): { status: "ok"; timestamp: string } {
  return { status: "ok", timestamp: new Date().toISOString() };
}
