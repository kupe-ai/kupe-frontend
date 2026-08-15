"use client";

import { cn } from "@/lib/utils";
import { AiStar } from "@/components/brand/ai-star";
import { useAskAiPanel } from "@/lib/ask-ai/panel-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AskAiToolbarButton({
  className,
  label = "Ask AI",
  labelClassName,
}: {
  className?: string;
  label?: string;
  labelClassName?: string;
}) {
  const { open, toggle } = useAskAiPanel();

  return (
    <Button
      type="button"
      variant={open ? "secondary" : "outline"}
      size="sm"
      onClick={() => {
        toggle();
        toast.message("Ask Kupe", {
          description: "Edit instructions on the left, then use Test agent for a live call.",
        });
      }}
      aria-pressed={open}
      aria-label={label}
      title={label}
      className={cn(
        "h-7 gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
        open && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        className,
      )}
    >
      <AiStar size={14} className="shrink-0" />
      <span className={labelClassName}>{label}</span>
    </Button>
  );
}
