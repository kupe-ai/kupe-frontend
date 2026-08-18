"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/ask-ai/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function formatJson(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ReasoningRow({
  step,
  active,
}: {
  step: Extract<AgentStep, { kind: "reasoning" }>;
  active: boolean;
}) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center gap-1.5 text-left hover:text-foreground"
      >
        <span className="kori-shimmer-text font-medium">Thinking...</span>
        {active ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 italic text-muted-foreground">{step.text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolCallRow({ step }: { step: Extract<AgentStep, { kind: "tool_call" }> }) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-start gap-1.5 text-left hover:text-foreground"
      >
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
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-[18px] mt-1.5 space-y-1.5">
          <div>
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Input</p>
            <pre className="max-h-48 overflow-auto rounded bg-background px-2 py-1.5 font-mono text-[11px] leading-snug">
              {formatJson(step.arguments) || "—"}
            </pre>
          </div>
          {step.done ? (
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {step.isError ? "Error" : "Output"}
              </p>
              <pre
                className={cn(
                  "max-h-48 overflow-auto rounded bg-background px-2 py-1.5 font-mono text-[11px] leading-snug",
                  step.isError && "text-destructive",
                )}
              >
                {formatJson(step.result) || "—"}
              </pre>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgentSteps({ steps, streaming }: { steps: AgentStep[]; streaming: boolean }) {
  const [open, setOpen] = useState(true);
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
              <ReasoningRow key={i} step={step} active={step === thinkingReasoning} />
            ) : (
              <ToolCallRow key={step.callId || i} step={step} />
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
