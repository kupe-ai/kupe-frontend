import { useState } from "react";
import { useDataChannel } from "@livekit/components-react";
import type { LatencyMessage, TTFBEntry } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type BreakdownState = {
  userTurnMs: number | null;
  ttfb: TTFBEntry[];
  textAggregationMs: number | null;
};

export default function LatencyPanel() {
  const [perceivedMs, setPerceivedMs] = useState<number | null>(null);
  const [firstGreetingMs, setFirstGreetingMs] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownState | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  useDataChannel((msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as LatencyMessage;
      if (parsed.kind !== "latency") return;

      if (parsed.type === "perceived_response") {
        setPerceivedMs(parsed.value_ms);
        setHistory((prev) => [...prev.slice(-9), parsed.value_ms]);
      } else if (parsed.type === "time_to_first_greeting") {
        setFirstGreetingMs(parsed.value_ms);
      } else if (parsed.type === "breakdown") {
        setBreakdown({
          userTurnMs: parsed.user_turn_ms,
          ttfb: parsed.ttfb,
          textAggregationMs: parsed.text_aggregation_ms,
        });
      }
    } catch {
      // ignore malformed data messages
    }
  });

  const avg =
    history.length > 0 ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : null;

  return (
    <Card className="flex h-full min-h-[320px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Latency</CardTitle>
        <CardDescription>Perceived response and per-component timing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="text-xs text-muted-foreground">You stop talking → agent&apos;s first audible word</div>
          <div className="mt-1 font-mono text-3xl font-medium tracking-tight text-foreground">
            {perceivedMs !== null ? `${Math.round(perceivedMs)} ms` : "—"}
          </div>
          {avg !== null && (
            <div className="mt-1 text-xs text-muted-foreground">
              avg over last {history.length}: {avg} ms
            </div>
          )}
        </div>

        {firstGreetingMs !== null && (
          <p className="text-sm text-muted-foreground">
            Time to first greeting:{" "}
            <span className="font-medium text-foreground">{Math.round(firstGreetingMs)} ms</span>
          </p>
        )}

        {breakdown && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Per-component breakdown</div>
            <Separator />
            {breakdown.userTurnMs !== null && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Turn detection (Smart Turn)</span>
                <span className="font-mono">{Math.round(breakdown.userTurnMs)} ms</span>
              </div>
            )}
            {breakdown.ttfb.map((t, i) => (
              <div className="flex justify-between gap-4 text-sm" key={i}>
                <span className="text-muted-foreground">
                  {t.processor} TTFB{t.model ? ` (${t.model})` : ""}
                </span>
                <span className="font-mono">{Math.round(t.value_ms)} ms</span>
              </div>
            ))}
            {breakdown.textAggregationMs !== null && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Sentence aggregation before TTS</span>
                <span className="font-mono">{Math.round(breakdown.textAggregationMs)} ms</span>
              </div>
            )}
          </div>
        )}

        {!breakdown && perceivedMs === null && (
          <p className="text-sm text-muted-foreground">Latency numbers appear after the first exchange.</p>
        )}
      </CardContent>
    </Card>
  );
}
