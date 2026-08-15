import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import { VoiceAgentsPageShimmer } from "@/components/ui/shimmer";

export default function VoiceAgentsLayout() {
  return (
    <Suspense fallback={<VoiceAgentsPageShimmer />}>
      <Outlet />
    </Suspense>
  );
}
