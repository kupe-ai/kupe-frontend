"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/ask-ai/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function AgentSteps({ steps, streaming }: { steps: AgentStep[]; streaming: boolean }) {
  const [open, setOpen] = useState(streaming);
  useEffect(() => {
    setOpen(streaming);
  }, [streaming]);
  const toolCalls = steps.filter((s) => s.kind === "tool_call").length;
  const thoughts = steps.filter((s) => s.kind === "reasoning").length;
  const parts = [
    toolCalls > 0 ? `${toolCalls} tool call${toolCalls === 1 ? "" : "s"}` : null,
    thoughts > 0 ? `${thoughts} thought${thoughts === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const last = steps[steps.length - 1];
  const thinkingReasoning = streaming && last?.kind === "reasoning" ? last : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-lg border border-border bg-muted/40 text-xs">
      <CollapsibleTrigger type="button" className="flex w-full items-center gap-1.5 px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {streaming ? <Loader2 className="size-3 animate-spin" /> : null}
        Agent steps{parts.length ? ` · ${parts.join(" · ")}` : ""}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1.5 border-t border-border px-2.5 py-2">
          {steps.map((step, i) =>
            step.kind === "reasoning" ? (
              <p
                key={i}
                className={cn(
                  "italic text-muted-foreground",
                  streaming && step === thinkingReasoning && "kori-shimmer-text not-italic",
                )}
              >
                {step.text}
              </p>
            ) : (
              <div key={step.callId || i} className="flex items-start gap-1.5">
                <Wrench
                  className={cn(
                    "mt-0.5 size-3 shrink-0",
                    step.isError ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <span className={cn("font-mono", step.isError && "text-destructive")}>{step.name}</span>
                  {!step.done ? (
                    <Loader2 className="ml-1 inline size-3 animate-spin text-muted-foreground" />
                  ) : (
                    <Check className={cn("ml-1 inline size-3", step.isError ? "text-destructive" : "text-emerald-500")} />
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function WorkingShimmer({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </span>
      <span className="kori-shimmer-text font-medium">{label}</span>
    </div>
  );
}
