import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import { VoiceAgentsShell } from "@/components/voice-agents/voice-agents-shell";
import { VoiceAgentsPageShimmer } from "@/components/ui/shimmer";

export default function VoiceAgentsLayout() {
  return (
    <VoiceAgentsShell>
      <Suspense fallback={<VoiceAgentsPageShimmer />}>
        <Outlet />
      </Suspense>
    </VoiceAgentsShell>
  );
}
