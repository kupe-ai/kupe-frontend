"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useWorkspaceOptional } from "@/context/workspace-context";
import {
  captureEvent,
  identifyGroup,
  identifyUser,
  initPosthog,
  isPosthogConfigured,
  resetPosthog,
} from "@/lib/posthog";

export const FEATURE_FLAG_KEYS = [
  "account_access",
  "feature_agents",
  "feature_outbound",
  "feature_inbound",
  "feature_phone_numbers",
  "feature_knowledge_base",
  "feature_analytics",
  "feature_voice_library",
  "feature_transfer",
  "feature_batch_calls",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

const DEFAULT_FLAGS: Record<string, boolean> = Object.fromEntries(FEATURE_FLAG_KEYS.map((k) => [k, true]));

type FlagsValue = {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (flag: FeatureFlagKey | string) => boolean;
  refresh: () => void;
};

const FlagsContext = createContext<FlagsValue | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const workspace = useWorkspaceOptional();
  const orgId = workspace?.org?.id;
  const [flags, setFlags] = useState<Record<string, boolean>>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!isPosthogConfigured()) return;
    initPosthog();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      resetPosthog();
      setFlags(DEFAULT_FLAGS);
      return;
    }
    const user = session.user;
    identifyUser(user.id, { email: user.email ?? undefined });
    captureEvent("user_logged_in");
  }, [session?.user?.id, session?.user?.email]);

  useEffect(() => {
    if (orgId) identifyGroup(orgId);
  }, [orgId]);

  const load = async () => {
    if (!session) {
      setFetched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getFeatureFlags(orgId);
      setFlags({ ...DEFAULT_FLAGS, ...res.flags });
      initPosthog({ distinctId: res.distinct_id, featureFlags: res.flags });
    } catch {
      setFlags(DEFAULT_FLAGS);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, orgId]);

  const value = useMemo<FlagsValue>(
    () => ({
      flags,
      loading: session ? !fetched || loading : false,
      isEnabled: (flag) => flags[flag] !== false,
      refresh: () => void load(),
    }),
    [flags, loading, session, fetched],
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFeatureFlags() {
  const ctx = useContext(FlagsContext);
  if (!ctx) {
    return {
      flags: DEFAULT_FLAGS,
      loading: false,
      isEnabled: () => true,
      refresh: () => undefined,
    } satisfies FlagsValue;
  }
  return ctx;
}
