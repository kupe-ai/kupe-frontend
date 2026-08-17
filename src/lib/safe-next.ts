/** In-app paths that should never be used as a post-auth return URL. */
const AUTH_PATHS = new Set(["/login", "/auth/callback", "/onboarding", "/integrations/callback"]);

/**
 * Only allow same-origin relative paths. Blocks `//evil`, `https://…`, and
 * bouncing back into the auth screens themselves.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return "/";
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  const pathname = path.split("?")[0]?.split("#")[0] ?? "/";
  if (AUTH_PATHS.has(pathname)) return "/";
  return path;
}

export function withNextParam(base: string, next: string): string {
  const safe = safeNextPath(next);
  if (safe === "/") return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}next=${encodeURIComponent(safe)}`;
}
