import { lazy, type ComponentType } from "react";
import { getLazyRouteComponent, recoverMissingLazyRoute } from "./lazy-route-module";
import { isStaleChunkError } from "./network-error";

/**
 * After a Vercel deploy, hashed `/assets/*.js` from the previous build 404.
 * Tabs that were already open still point at those old URLs, so React.lazy
 * throws `Failed to fetch dynamically imported module`. Reload once to pick
 * up the new index.html (which is Cache-Control: no-store). A sessionStorage
 * flag stops a reload loop if the file is genuinely missing.
 */
const RELOAD_KEY = "kupe:stale-chunk-reload";

/** True only for a reload started during this JS lifetime — not a prior tab load. */
let reloadTriggeredThisPage = false;

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
  reloadTriggeredThisPage = true;
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

function waitForReload(): Promise<never> {
  return new Promise<never>(() => {});
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
      const component = getLazyRouteComponent(mod);
      if (!component) {
        // preventDefault() on vite:preloadError makes __vitePreload resolve
        // to undefined instead of rejecting. Hang until the reload lands so
        // we don't report "missing a default export" to PostHog.
        if (recoverMissingLazyRoute(reloadTriggeredThisPage, reloadOnceForStaleChunk) === "wait") {
          return waitForReload();
        }
        throw new TypeError("Lazy route module is missing a default export");
      }
      clearStaleChunkReloadFlag();
      return { default: component } as T;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;
      if (recoverMissingLazyRoute(reloadTriggeredThisPage, reloadOnceForStaleChunk) === "wait") {
        return waitForReload();
      }
      throw error;
    }
  });
}
