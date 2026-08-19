"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { KAI_AVATAR_SEED } from "@/components/voice-agents/nav-item-icon";
import { Button } from "@/components/ui/button";

export function AskAiToolbarButton({
  className,
  label = "Ask Kai",
  labelClassName,
}: {
  className?: string;
  label?: string;
  labelClassName?: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = pathname === "/ask-kupe" || pathname.startsWith("/ask-kupe/");

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="sm"
      onClick={() => navigate("/ask-kupe")}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "h-7 gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        className,
      )}
    >
      <AgentAvatar seed={KAI_AVATAR_SEED} size={14} className="shrink-0" alt="" />
      <span className={labelClassName}>{label}</span>
    </Button>
  );
}
