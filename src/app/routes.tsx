import { Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedLayout from "@/app/protected-layout";
import VoiceAgentsLayout from "@/app/voice-agents-layout";
import { VoiceAgentsPageShimmer, VoiceEditorShimmer } from "@/components/ui/shimmer";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { useFeatureFlags } from "@/context/feature-flags-context";

function Flagged({ flag, children }: { flag: string; children: ReactNode }) {
  const { isEnabled, loading } = useFeatureFlags();
  if (loading) return null;
  if (!isEnabled(flag)) return <Navigate to="/" replace />;
  return children;
}

const LoginPage = lazyWithRetry(() => import("@/pages/login/page"));
const AuthCallbackPage = lazyWithRetry(() => import("@/pages/auth-callback/page"));
const IntegrationsCallbackPage = lazyWithRetry(() => import("@/pages/integrations-callback/page"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/onboarding/page"));
const VoiceAgentsHomePage = lazyWithRetry(() => import("@/pages/voice-agents/page"));
const VoiceAgentsAgentsPage = lazyWithRetry(() => import("@/pages/voice-agents/agents/page"));
const VoiceAgentEditorPage = lazyWithRetry(() => import("@/pages/voice-agents/agents/[id]/page"));
const VoiceAgentsKnowledgePage = lazyWithRetry(() => import("@/pages/voice-agents/knowledge-base/page"));
const VoiceLibraryPage = lazyWithRetry(() => import("@/pages/voice-agents/voice-library/page"));
const VoiceAgentsIntegrationsPage = lazyWithRetry(() => import("@/pages/voice-agents/integrations/page"));
const VoiceAgentsKnowledgeDetailPage = lazyWithRetry(
  () => import("@/pages/voice-agents/knowledge-base/[id]/page"),
);
const VoiceAgentsPhoneNumbersPage = lazyWithRetry(
  () => import("@/pages/voice-agents/phone-numbers/page"),
);
const VoiceAgentsInboundPage = lazyWithRetry(() => import("@/pages/voice-agents/inbound-calls/page"));
const VoiceAgentsOutboundPage = lazyWithRetry(
  () => import("@/pages/voice-agents/outbound-campaigns/page"),
);
const VoiceAgentsDeployCodePage = lazyWithRetry(
  () => import("@/pages/voice-agents/deploy-with-code/page"),
);
const VoiceAgentsDeployApiPage = lazyWithRetry(
  () => import("@/pages/voice-agents/deploy-with-code/apis/[slug]/page"),
);
const VoiceAgentsDeployRecipePage = lazyWithRetry(
  () => import("@/pages/voice-agents/deploy-with-code/recipes/[slug]/page"),
);
const VoiceAgentsAnalyticsPage = lazyWithRetry(() => import("@/pages/voice-agents/analytics/page"));
const VoiceAgentsUsagePage = lazyWithRetry(() => import("@/pages/voice-agents/usage/page"));
const VoiceAgentsBillingPage = lazyWithRetry(() => import("@/pages/voice-agents/billing/page"));
const VoiceAgentsSettingsPage = lazyWithRetry(() => import("@/pages/voice-agents/settings/page"));
const VoiceAgentsDocsPage = lazyWithRetry(() => import("@/pages/voice-agents/documentation/page"));

function PageFallback() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

/** Old /voice-agents/... bookmarks → /... */
function LegacyVoiceAgentsRedirect() {
  const { pathname, search } = useLocation();
  const rest = pathname.replace(/^\/voice-agents/, "") || "/";
  return <Navigate to={`${rest}${search}`} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/integrations/callback" element={<IntegrationsCallbackPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<ProtectedLayout />}>
          <Route element={<VoiceAgentsLayout />}>
            <Route
              path="/"
              element={
                <Suspense fallback={<VoiceAgentsPageShimmer />}>
                  <VoiceAgentsHomePage />
                </Suspense>
              }
            />
            <Route path="/agents" element={<Flagged flag="feature_agents"><VoiceAgentsAgentsPage /></Flagged>} />
            <Route
              path="/agents/:id"
              element={
                <Flagged flag="feature_agents">
                <Suspense fallback={<VoiceEditorShimmer />}>
                  <VoiceAgentEditorPage />
                </Suspense>
                </Flagged>
              }
            />
            <Route path="/knowledge-base" element={<Flagged flag="feature_knowledge_base"><VoiceAgentsKnowledgePage /></Flagged>} />
            <Route path="/knowledge-base/:id" element={<Flagged flag="feature_knowledge_base"><VoiceAgentsKnowledgeDetailPage /></Flagged>} />
            <Route path="/voice-library" element={<Flagged flag="feature_voice_library"><VoiceLibraryPage /></Flagged>} />
            <Route path="/integrations" element={<VoiceAgentsIntegrationsPage />} />
            <Route path="/phone-numbers" element={<Flagged flag="feature_phone_numbers"><VoiceAgentsPhoneNumbersPage /></Flagged>} />
            <Route path="/inbound-calls" element={<Flagged flag="feature_inbound"><VoiceAgentsInboundPage /></Flagged>} />
            <Route path="/outbound-campaigns" element={<Flagged flag="feature_outbound"><VoiceAgentsOutboundPage /></Flagged>} />
            <Route path="/deploy-with-code" element={<VoiceAgentsDeployCodePage />} />
            <Route path="/deploy-with-code/apis/:slug" element={<VoiceAgentsDeployApiPage />} />
            <Route path="/deploy-with-code/recipes/:slug" element={<VoiceAgentsDeployRecipePage />} />
            <Route path="/analytics" element={<Flagged flag="feature_analytics"><VoiceAgentsAnalyticsPage /></Flagged>} />
            <Route path="/usage" element={<VoiceAgentsUsagePage />} />
            <Route path="/billing" element={<VoiceAgentsBillingPage />} />
            <Route path="/settings" element={<VoiceAgentsSettingsPage />} />
            <Route path="/documentation" element={<VoiceAgentsDocsPage />} />
            <Route path="/voice-agents" element={<Navigate to="/" replace />} />
            <Route path="/voice-agents/*" element={<LegacyVoiceAgentsRedirect />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
