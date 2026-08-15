import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedLayout from "@/app/protected-layout";
import VoiceAgentsLayout from "@/app/voice-agents-layout";
import { VoiceAgentsPageShimmer, VoiceEditorShimmer } from "@/components/ui/shimmer";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

const LoginPage = lazyWithRetry(() => import("@/pages/login/page"));
const AuthCallbackPage = lazyWithRetry(() => import("@/pages/auth-callback/page"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/onboarding/page"));
const VoiceAgentsHomePage = lazyWithRetry(() => import("@/pages/voice-agents/page"));
const VoiceAgentsAgentsPage = lazyWithRetry(() => import("@/pages/voice-agents/agents/page"));
const VoiceAgentEditorPage = lazyWithRetry(() => import("@/pages/voice-agents/agents/[id]/page"));
const VoiceAgentsKnowledgePage = lazyWithRetry(() => import("@/pages/voice-agents/knowledge-base/page"));
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
const VoiceAgentsSettingsPage = lazyWithRetry(() => import("@/pages/voice-agents/settings/page"));
const VoiceAgentsPricingPage = lazyWithRetry(() => import("@/pages/voice-agents/pricing/page"));
const VoiceAgentsDocsPage = lazyWithRetry(() => import("@/pages/voice-agents/documentation/page"));

function PageFallback() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<ProtectedLayout />}>
          <Route element={<VoiceAgentsLayout />}>
            <Route path="/" element={<Navigate to="/voice-agents" replace />} />
            <Route
              path="/voice-agents"
              element={
                <Suspense fallback={<VoiceAgentsPageShimmer />}>
                  <VoiceAgentsHomePage />
                </Suspense>
              }
            />
            <Route path="/voice-agents/agents" element={<VoiceAgentsAgentsPage />} />
            <Route
              path="/voice-agents/agents/:id"
              element={
                <Suspense fallback={<VoiceEditorShimmer />}>
                  <VoiceAgentEditorPage />
                </Suspense>
              }
            />
            <Route path="/voice-agents/knowledge-base" element={<VoiceAgentsKnowledgePage />} />
            <Route path="/voice-agents/knowledge-base/:id" element={<VoiceAgentsKnowledgeDetailPage />} />
            <Route path="/voice-agents/phone-numbers" element={<VoiceAgentsPhoneNumbersPage />} />
            <Route path="/voice-agents/inbound-calls" element={<VoiceAgentsInboundPage />} />
            <Route path="/voice-agents/outbound-campaigns" element={<VoiceAgentsOutboundPage />} />
            <Route path="/voice-agents/deploy-with-code" element={<VoiceAgentsDeployCodePage />} />
            <Route path="/voice-agents/deploy-with-code/apis/:slug" element={<VoiceAgentsDeployApiPage />} />
            <Route
              path="/voice-agents/deploy-with-code/recipes/:slug"
              element={<VoiceAgentsDeployRecipePage />}
            />
            <Route path="/voice-agents/analytics" element={<VoiceAgentsAnalyticsPage />} />
            <Route path="/voice-agents/settings" element={<VoiceAgentsSettingsPage />} />
            <Route path="/voice-agents/pricing" element={<VoiceAgentsPricingPage />} />
            <Route path="/voice-agents/documentation" element={<VoiceAgentsDocsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/voice-agents" replace />} />
      </Routes>
    </Suspense>
  );
}
