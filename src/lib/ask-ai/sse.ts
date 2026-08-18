/** Parses a `text/event-stream` body into harness events.
 *
 * sse-starlette uses CRLF (`\\r\\n\\r\\n`) between frames; some proxies
 * rewrite to LF. We accept both, and flush a trailing partial frame when
 * the stream ends so a last `done` without a trailing blank line isn't dropped.
 */
import type { HarnessEvent } from "./types";

export function parseSseFrame(frame: string): HarnessEvent | null {
  const normalized = frame.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const dataLine = normalized.split("\n").find((l) => l.startsWith("data:"));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice(5).trim()) as HarnessEvent;
  } catch {
    return null;
  }
}

function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  return { frames: parts.slice(0, -1), rest: parts[parts.length - 1] ?? "" };
}

export async function* readSse(response: Response): AsyncGenerator<HarnessEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      const leftover = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
      if (leftover) {
        const event = parseSseFrame(leftover);
        if (event) yield event;
      }
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = splitFrames(buffer);
    buffer = rest;
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) yield event;
    }
  }
}

/** Tiny unit-testable helper: parse a whole SSE payload (CRLF or LF) into events. */
export function parseSsePayload(payload: string): HarnessEvent[] {
  const { frames, rest } = splitFrames(payload.endsWith("\n\n") || payload.endsWith("\r\n\r\n") ? payload : payload + "\n\n");
  const out: HarnessEvent[] = [];
  for (const frame of [...frames, rest]) {
    const event = parseSseFrame(frame);
    if (event) out.push(event);
  }
  return out;
}

if (import.meta.env.DEV) {
  const crlf = parseSsePayload('event: done\r\ndata: {"type":"done","finish_reason":"stop"}\r\n\r\n');
  const lf = parseSsePayload('event: reasoning\ndata: {"type":"reasoning","text":"hi"}\n\n');
  if (crlf[0]?.type !== "done" || lf[0]?.type !== "reasoning") {
    console.error("SSE parser failed CRLF/LF smoke check", crlf, lf);
  }
}
