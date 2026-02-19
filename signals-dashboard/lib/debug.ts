export function debugToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_TOOLS === "1";
}
