/** Browser `fetch()` / `import()` transport failures. Chrome: "Failed to
 * fetch"; Safari: "Load failed"; Firefox: "NetworkError when attempting to
 * fetch resource". These are connectivity/CORS/offline — not application bugs. */

export const NETWORK_UNREACHABLE = "Couldn't reach Kupe. Check your connection and try again.";

export function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError";
}

function errorText(err: unknown): { name: string; message: string } {
  return {
    name: err instanceof Error ? err.name : "",
    message: err instanceof Error ? err.message : String(err ?? ""),
  };
}

export function isStaleChunkError(err: unknown): boolean {
  const { name, message } = errorText(err);
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  );
}

export function isBrowserNetworkError(err: unknown): boolean {
  if (isAbortError(err) || isStaleChunkError(err)) return false;
  const { name, message } = errorText(err);
  if (name === "NetworkError" || name === "TimeoutError") return true;
  return (
    /Failed to fetch/i.test(message) ||
    /^Load failed$/i.test(message) ||
    /NetworkError when attempting to fetch resource/i.test(message) ||
    /network request failed/i.test(message) ||
    /fetch failed/i.test(message)
  );
}
