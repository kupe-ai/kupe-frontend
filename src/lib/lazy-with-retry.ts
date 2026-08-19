import { lazy, type ComponentType } from "react";
import { isStaleChunkError } from "./network-error";

/**
 * After a Vercel deploy, hashed `/assets/*.js` from the previous build 404.
 * Tabs that were already open still point at those old URLs, so React.lazy
 * throws `Failed to fetch dynamically imported module`. Reload once to pick
 * up the new index.html (which is Cache-Control: no-store). A sessionStorage
 * flag stops a reload loop if the file is genuinely missing.
 */
const RELOAD_KEY = "kupe:stale-chunk-reload";

export function isChunkLoadError(error: unknown): boolean {
  return isStaleChunkError(error);
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
      // React.lazy does `payload._result.default`. A resolved-but-undefined
      // module throws TypeError: can't access property "default", _result is undefined.
      if (!mod?.default) {
        throw new TypeError("Lazy route module is missing a default export");
      }
      clearStaleChunkReloadFlag();
      return mod;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;
      if (reloadOnceForStaleChunk()) {
        await new Promise<never>(() => {});
      }
      throw error;
    }
  });
}
