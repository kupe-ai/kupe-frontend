/** Component-ish: a function, or a React memo/forwardRef object. */
function isComponent(value: unknown): boolean {
  return typeof value === "function" || (value != null && typeof value === "object");
}

/**
 * React.lazy requires `{ default: Component }`. Vite's `__vitePreload` can
 * resolve to `undefined` after a `vite:preloadError` listener calls
 * preventDefault, and CJS interop can yield the component itself.
 */
export function getLazyRouteComponent(mod: unknown): unknown {
  if (typeof mod === "function") return mod;
  if (mod && typeof mod === "object" && "default" in mod) {
    const d = (mod as { default: unknown }).default;
    if (isComponent(d)) return d;
  }
  return undefined;
}

/**
 * A missing lazy module after a deploy is almost always a stale chunk, not a
 * missing `export default`. If a reload is already in flight (or we can start
 * one), wait for it instead of throwing — throwing is what PostHog records.
 */
export function recoverMissingLazyRoute(
  reloadStartedThisPage: boolean,
  startReload: () => boolean,
): "wait" | "throw" {
  if (reloadStartedThisPage || startReload()) return "wait";
  return "throw";
}
