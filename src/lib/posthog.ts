import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

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
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    disable_session_recording: !replay,
    bootstrap: {
      distinctID: opts?.distinctId,
      featureFlags: opts?.featureFlags,
    },
    loaded: () => {
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

export function captureEvent(event: string, properties?: Record<string, unknown>): void {
  if (!KEY) return;
  posthog.capture(event, properties);
}

export function resetPosthog(): void {
  if (!KEY) return;
  posthog.reset();
}

export { posthog };
