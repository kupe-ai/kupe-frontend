/** Shared API error types — safe for both server and client bundles. */

export class KoriApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function formatApiError(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const root = body as { detail?: unknown; code?: unknown; message?: unknown };
  if (root.code === "usage_limit_exceeded") {
    return typeof root.message === "string" && root.message.trim()
      ? root.message
      : "Usage limit exceeded";
  }
  const detail = root.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { code?: unknown; message?: unknown };
    if (d.code === "usage_limit_exceeded") {
      return typeof d.message === "string" && d.message.trim()
        ? d.message
        : "Usage limit exceeded";
    }
    if (typeof d.message === "string" && d.message.trim()) return d.message;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return String(item);
      })
      .join(", ");
  }
  return "Request failed";
}
