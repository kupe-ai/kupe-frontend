import posthog from "posthog-js";

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

export function isPosthogConfigured(): boolean {
  return Boolean(KEY);
}

export function initPosthog(opts?: {
  distinctId?: string;
  featureFlags?: Record<string, boolean | string>;
}): void {
  if (!KEY || started) return;
  const replay = Math.random() < 0.1;
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: UI_HOST,
    autocapture: false,
    capture_dead_clicks: false,
    capture_pageview: true,
    capture_pageleave: true,
    capture_exceptions: true,
    persistence: "localStorage+cookie",
    disable_session_recording: !replay,
    bootstrap: {
      distinctID: opts?.distinctId,
      featureFlags: opts?.featureFlags,
    },
    loaded: (ph) => {
      ph.register({ service: "kupe-frontend" });
      started = true;
    },
  });
  started = true;
}

export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!KEY) return;
  initPosthog({ distinctId: userId });
  posthog.identify(userId, properties);
}

export function identifyGroup(orgId: string, properties?: Record<string, string | number | boolean | null>): void {
  if (!KEY) return;
  posthog.group("organization", orgId, properties);
}

export function captureException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!KEY) return;
  initPosthog();
  const err = error instanceof Error ? error : new Error(String(error));
  posthog.captureException(err, properties);
}

export function resetPosthog(): void {
  if (!KEY) return;
  posthog.reset();
}

export { posthog };
