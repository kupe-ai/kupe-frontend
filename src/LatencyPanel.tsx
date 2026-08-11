import { useState } from "react";
import { useDataChannel } from "@livekit/components-react";
import type { LatencyMessage, TTFBEntry } from "./types";

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
    <div className="latency-panel">
      <h2>Latency</h2>
      <div className="latency-hero">
        <span className="latency-hero-label">
          You stop talking &rarr; agent's first audible word
        </span>
        <span className="latency-hero-value">
          {perceivedMs !== null ? `${Math.round(perceivedMs)} ms` : "—"}
        </span>
        {avg !== null && <span className="latency-hero-avg">avg over last {history.length}: {avg} ms</span>}
      </div>

      {firstGreetingMs !== null && (
        <p className="latency-line">
          Time to first greeting (connect &rarr; first speech): <strong>{Math.round(firstGreetingMs)} ms</strong>
        </p>
      )}

      {breakdown && (
        <div className="latency-breakdown">
          <h3>Per-component breakdown (last turn)</h3>
          {breakdown.userTurnMs !== null && (
            <div className="latency-row">
              <span>Turn detection (VAD + STT finalize)</span>
              <span>{Math.round(breakdown.userTurnMs)} ms</span>
            </div>
          )}
          {breakdown.ttfb.map((t, i) => (
            <div className="latency-row" key={i}>
              <span>
                {t.processor} TTFB{t.model ? ` (${t.model})` : ""}
              </span>
              <span>{Math.round(t.value_ms)} ms</span>
            </div>
          ))}
          {breakdown.textAggregationMs !== null && (
            <div className="latency-row">
              <span>Sentence aggregation before TTS</span>
              <span>{Math.round(breakdown.textAggregationMs)} ms</span>
            </div>
          )}
        </div>
      )}

      {!breakdown && perceivedMs === null && (
        <p className="transcript-empty">Latency numbers appear after the first exchange.</p>
      )}
    </div>
  );
}
