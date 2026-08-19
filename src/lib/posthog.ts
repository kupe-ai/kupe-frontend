import posthog from "posthog-js";
import { isAbortError, isBrowserNetworkError, isStaleChunkError, NETWORK_UNREACHABLE } from "./network-error";
import { isConcurrencyLimitError } from "./voice/concurrency-limit";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// Routed through our own origin (see the /ingest rewrite in vercel.json and
// the matching vite dev-server proxy) instead of us.i.posthog.com directly --
// ad blockers (uBlock, Brave, etc.) block that domain wholesale, which was
// silently dropping every capture call as ERR_BLOCKED_BY_CLIENT.
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "/ingest";
// Unrelated to api_host: only used for toolbar/session-recording deep links,
// which must point at the real PostHog UI regardless of the ingest proxy.
const UI_HOST = "https://us.posthog.com";

let started = false;

/** Events, exceptions, logs, and session replay only ship in a production build. */
export function ingestEnabled(): boolean {
  const mode = (import.meta.env.VITE_MODE || "dev").toLowerCase();
  return mode === "prod" && !import.meta.env.DEV;
}

export function isPosthogConfigured(): boolean {
  return Boolean(KEY);
}

export function initPosthog(opts?: {
  distinctId?: string;
  featureFlags?: Record<string, boolean | string>;
}): void {
  if (!KEY || started) return;
  const ingest = ingestEnabled();
  const replay = ingest && Math.random() < 0.1;
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: UI_HOST,
    autocapture: false,
    capture_dead_clicks: false,
    capture_pageview: ingest,
    capture_pageleave: ingest,
    capture_exceptions: ingest,
    persistence: "localStorage+cookie",
    disable_session_recording: !replay,
    opt_out_capturing_by_default: !ingest,
    before_send: dropTransportNoise,
    bootstrap: {
      distinctID: opts?.distinctId,
      featureFlags: opts?.featureFlags,
    },
    loaded: (ph) => {
      ph.register({ service: "kupe-frontend" });
      if (!ingest) {
        ph.opt_out_capturing();
      }
      started = true;
    },
  });
  started = true;
}

export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!KEY || !ingestEnabled()) return;
  initPosthog({ distinctId: userId });
  posthog.identify(userId, properties);
}

export function identifyGroup(orgId: string, properties?: Record<string, string | number | boolean | null>): void {
  if (!KEY || !ingestEnabled()) return;
  posthog.group("organization", orgId, properties);
}

export function captureEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!KEY || !ingestEnabled()) return;
  initPosthog();
  posthog.capture(event, properties);
}

export function captureException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!KEY || !ingestEnabled()) return;
  if (isTransportNoise(error)) return;
  if (isConcurrencyLimitError(error)) {
    captureEvent("concurrency_limit_reached", {
      level: "warning",
      ...properties,
      message: error instanceof Error ? error.message : String(error ?? ""),
    });
    return;
  }
  initPosthog();
  const err = error instanceof Error ? error : new Error(String(error));
  posthog.captureException(err, properties);
}

function isTransportNoise(error: unknown): boolean {
  if (isAbortError(error) || isBrowserNetworkError(error) || isStaleChunkError(error)) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message === NETWORK_UNREACHABLE;
}

/** Offline / CORS / aborted fetch / stale Vite chunks are not product bugs. */
function dropTransportNoise<T extends { event?: string; properties?: Record<string, unknown> }>(
  event: T | null,
): T | null {
  if (!event || event.event !== "$exception") return event;
  const props = event.properties ?? {};
  const values: unknown[] = [];
  if (typeof props.$exception_message === "string") values.push(props.$exception_message);
  if (typeof props.message === "string") values.push(props.message);
  if (Array.isArray(props.$exception_values)) values.push(...props.$exception_values);
  if (Array.isArray(props.$exception_list)) {
    for (const item of props.$exception_list) {
      if (item && typeof item === "object" && "value" in item) {
        values.push((item as { value: unknown }).value);
      }
    }
  }
  for (const value of values) {
    const err = value instanceof Error ? value : new Error(String(value ?? ""));
    if (isTransportNoise(err) || isConcurrencyLimitError(err)) {
      return null;
    }
  }
  return event;
}

export function resetPosthog(): void {
  if (!KEY) return;
  posthog.reset();
}

export { posthog };
