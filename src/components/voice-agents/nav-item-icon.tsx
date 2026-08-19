import { cn } from "@/lib/utils";
import { ModernIcon } from "@/components/icons/modern-icon";
import type { KupeIconName } from "@/components/icons/kupe-icon";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";

/** Stable seed so Kai's mark matches the agent-avatar style, not sparkles. */
export const KAI_AVATAR_SEED = "kai";

export function NavItemIcon({
  id,
  icon,
  className = "size-5",
}: {
  id: string;
  icon: KupeIconName;
  className?: string;
}) {
  if (id === "ask-kupe") {
    return <AgentAvatar seed={KAI_AVATAR_SEED} fade size={20} alt="" className={cn("shrink-0", className)} />;
  }
  return <ModernIcon name={icon} className={className} />;
}
