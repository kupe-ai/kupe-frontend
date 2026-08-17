"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { getTestRun } from "@/lib/api/voice/agent-builder";
import type { AgentTestRun, AgentTestRunResult } from "@/types";

const POLL_MS = 2000;

export function TestRunDetailPanel({
  agentId,
  runId,
  onOpenChange,
}: {
  agentId: string;
  runId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [run, setRun] = useState<AgentTestRun | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      return;
    }
    let cancelled = false;

    async function tick() {
      if (!runId) return;
      const next = await getTestRun(agentId, runId);
      if (cancelled) return;
      setRun(next);
      if (next.status === "queued" || next.status === "running") {
        pollRef.current = window.setTimeout(tick, POLL_MS);
      }
    }
    void tick();

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [agentId, runId]);

  const inFlight = run?.status === "queued" || run?.status === "running";

  return (
    <Sheet open={!!runId} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {run?.run_name || "Test run"}
            {run ? <StatusChip status={run.status} /> : null}
            {inFlight ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
          </SheetTitle>
          <SheetDescription>
            {run ? `${run.completed_test_count}/${run.total_test_count} tests · v${run.agent_version}` : "Loading…"}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {!run ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : (run.results ?? []).length === 0 ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Starting…
            </div>
          ) : (
            (run.results ?? []).map((r) => <ResultCard key={r.id} result={r} />)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ResultCard({ result }: { result: AgentTestRunResult }) {
  const [open, setOpen] = useState(false);
  const busy = result.status === "queued" || result.status === "running";

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" /> : null}
          <span className="truncate text-sm font-medium">
            {result.test_name}
            {result.attempt_number > 1 ? ` (#${result.attempt_number})` : ""}
          </span>
        </span>
        <StatusChip status={result.status} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border bg-muted/20 px-3.5 py-3 text-sm">
          {result.error ? <p className="text-destructive">{result.error}</p> : null}

          {result.transcript.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Simulated transcript</p>
              <ul className="space-y-1.5 rounded-lg bg-background px-3 py-2">
                {result.transcript.map((t, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium capitalize">{t.role}: </span>
                    <span className="text-muted-foreground">{t.content}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.behavior_results.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Expected behaviors</p>
              <ul className="space-y-1">
                {result.behavior_results.map((b, i) => (
                  <li key={i} className="text-xs">
                    {b.met ? "✓" : "✗"} {b.behavior}
                    {b.evidence ? <span className="text-muted-foreground"> — {b.evidence}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.tool_calls_made.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Tool calls made (simulated, never executed)</p>
              <ul className="space-y-1">
                {result.tool_calls_made.map((c, i) => (
                  <li key={i} className="rounded-lg bg-background px-2.5 py-1.5 font-mono text-xs">
                    {c.name}({JSON.stringify(c.args)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.judge_reasoning ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Judge reasoning</p>
              <p className="text-xs text-muted-foreground">{result.judge_reasoning}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
