/** Chat-facing copy. Vendor names, JSON blobs, and subscription-tier
 * messages must never render in the Ask Kai UI -- PostHog still gets
 * the raw payload from the harness / captureException properties. */

import { isAbortError, isBrowserNetworkError } from "@/lib/network-error";

export const GENERIC_CHAT_ERROR = "Kupe couldn't complete that request. Please try again.";

const VENDOR_OR_TECHNICAL =
  /sarvam|kupe-mcp|api\.sarvam|subscription tier|max_tokens|invalid_request_error|endpoint returned|model call failed|Failed to fetch|Load failed|NetworkError/i;

export function sanitizeChatError(raw: unknown, fallback = GENERIC_CHAT_ERROR): string {
  if (isAbortError(raw) || isBrowserNetworkError(raw)) return fallback;
  const text = (raw instanceof Error ? raw.message : String(raw ?? "")).trim();
  if (!text) return fallback;
  if (VENDOR_OR_TECHNICAL.test(text) || text.includes("{") || text.includes("Traceback")) {
    return fallback;
  }
  if (text.length > 180) return fallback;
  if (/failed:\s*\d{3}\b/i.test(text) || /:\s*403\b/.test(text)) return fallback;
  return text;
}
