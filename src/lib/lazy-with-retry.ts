import { lazy, type ComponentType } from "react";

/**
 * After a Vercel deploy, hashed `/assets/*.js` from the previous build 404.
 * Tabs that were already open still point at those old URLs, so React.lazy
 * throws `Failed to fetch dynamically imported module`. Reload once to pick
 * up the new index.html (which is Cache-Control: no-store). A sessionStorage
 * flag stops a reload loop if the file is genuinely missing.
 */
const RELOAD_KEY = "kupe:stale-chunk-reload";

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  );
}

export function reloadOnceForStaleChunk(): boolean {
  if (!import.meta.env.PROD) return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

function clearStaleChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // private mode / blocked storage
  }
}

/** Vite's official hook for deleted chunks after a new deploy. */
export function installStaleChunkReload(): void {
  if (!import.meta.env.PROD) return;
  window.addEventListener("vite:preloadError", (event) => {
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
    } catch {
      return;
    }
    event.preventDefault();
    reloadOnceForStaleChunk();
  });
}

export function lazyWithRetry<T extends { default: ComponentType }>(
  factory: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearStaleChunkReloadFlag();
      return mod;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;
      if (reloadOnceForStaleChunk()) {
        return new Promise<T>(() => {});
      }
      throw error;
    }
  });
}
