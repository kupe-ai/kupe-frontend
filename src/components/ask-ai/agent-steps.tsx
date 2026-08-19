"use client";

import { useEffect, useState } from "react";
import { Brain, Check, ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react";
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
    <Collapsible defaultOpen={false} className="group/thought">
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
      >
        <Brain className="size-3 shrink-0 text-muted-foreground" />
        {active ? (
          <span className="kori-shimmer-text font-medium">Thinking...</span>
        ) : (
          <>
            <span className="font-medium text-foreground">Thought</span>
            <span className="text-muted-foreground">briefly</span>
            <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]/thought:rotate-90" />
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 text-muted-foreground">{step.text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolCallRow({ step }: { step: Extract<AgentStep, { kind: "tool_call" }> }) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-start gap-1.5 text-left text-muted-foreground hover:text-foreground"
      >
        <Wrench className="mt-0.5 size-3 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-foreground">{step.name}</span>
          {!step.done ? (
            <Loader2 className="ml-1.5 inline size-3 animate-spin" />
          ) : step.isError ? (
            <span className="ml-1.5 text-muted-foreground">attempted</span>
          ) : (
            <Check className="ml-1.5 inline size-3 text-emerald-500" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-[18px] mt-1.5 space-y-1.5">
          <div>
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Input</p>
            <pre className="max-h-48 overflow-auto rounded bg-background px-2 py-1.5 font-mono text-[11px] leading-snug text-muted-foreground">
              {formatJson(step.arguments) || "—"}
            </pre>
          </div>
          {step.done ? (
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Output</p>
              <pre className="max-h-48 overflow-auto rounded bg-background px-2 py-1.5 font-mono text-[11px] leading-snug text-muted-foreground">
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
