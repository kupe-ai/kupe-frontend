"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Matrix, type Frame } from "@/components/ui/matrix";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL } from "@/lib/voice-deploy-data";
import { createVoiceApiKey, listVoiceApiKeys } from "@/lib/api/voice/api-keys";
import type { VoiceApiKey } from "@/lib/api/voice/types";
import { cn } from "@/lib/utils";

type SdkLang = "typescript" | "python" | "curl";

const WS_HOST = API_BASE_URL.replace(/^https?:\/\//, "");
const SAMPLE_AGENT = "agt_collections_demo";
const SAMPLE_VOICE = "priya";

/**
 * Snippets hit the real Kupe contract verified against
 * POST /v1/realtime/sessions (agent_id required, voice optional name)
 * and wss://…/v1/realtime?model=kupe-realtime&client_secret=…
 * OpenAI SDK `client.post("/realtime/sessions", …)` is used so custom
 * fields (agent_id) are not stripped by typed sessions.create params.
 */
function buildSnippet(lang: SdkLang, apiKey: string): string {
  switch (lang) {
    case "typescript":
      return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${API_BASE_URL}/v1",
});

// Mint ephemeral session — agent_id is required by Kupe
type KupeSession = {
  client_secret: { value: string };
  websocket_url: string;
};

const session = (await client.post("/realtime/sessions", {
  body: {
    agent_id: "${SAMPLE_AGENT}",
    voice: "${SAMPLE_VOICE}",
  },
})) as KupeSession;

const secret = session.client_secret.value;
const ws = new WebSocket(
  \`\${session.websocket_url}?model=kupe-realtime&client_secret=\${secret}\`,
);

ws.onopen = () => {
  // Text turn demo (mic uses PCM16 mono @ 24 kHz via input_audio_buffer.append)
  ws.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Hi Priya — remind this customer their EMI is due tomorrow.",
          },
        ],
      },
    }),
  );
  ws.send(JSON.stringify({ type: "response.create" }));
};

ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.type === "response.output_audio.delta") {
    // msg.delta → base64 PCM16 — enqueue on your audio player
  }
  if (msg.type === "response.output_audio_transcript.done") {
    console.log("agent:", msg.transcript);
  }
};`;
    case "python":
      return `import json

from openai import OpenAI
from pydantic import BaseModel, ConfigDict
import websocket  # pip install websocket-client

class KupeSession(BaseModel):
    model_config = ConfigDict(extra="allow")
    client_secret: dict
    websocket_url: str


client = OpenAI(
    api_key="${apiKey}",
    base_url="${API_BASE_URL}/v1",
)

# Mint ephemeral session — agent_id is required by Kupe
session = client.post(
    "/realtime/sessions",
    body={
        "agent_id": "${SAMPLE_AGENT}",
        "voice": "${SAMPLE_VOICE}",
    },
    cast_to=KupeSession,
)

secret = session.client_secret["value"]
ws_url = f"{session.websocket_url}?model=kupe-realtime&client_secret={secret}"


def on_open(ws):
    # Text turn demo (mic uses PCM16 mono @ 24 kHz via input_audio_buffer.append)
    ws.send(
        json.dumps(
            {
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "Hi Priya — remind this customer their EMI is due tomorrow.",
                        }
                    ],
                },
            }
        )
    )
    ws.send(json.dumps({"type": "response.create"}))


def on_message(_ws, message):
    msg = json.loads(message)
    if msg.get("type") == "response.output_audio.delta":
        # msg["delta"] → base64 PCM16 — enqueue on your audio player
        return
    if msg.get("type") == "response.output_audio_transcript.done":
        print("agent:", msg.get("transcript"))


ws = websocket.WebSocketApp(ws_url, on_open=on_open, on_message=on_message)
ws.run_forever()`;
    case "curl":
      return `# 1) Mint a session (returns client_secret + websocket_url)
curl -sS -X POST "${API_BASE_URL}/v1/realtime/sessions" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "${SAMPLE_AGENT}",
    "voice": "${SAMPLE_VOICE}"
  }'

# 2) Connect WebSocket (replace SECRET from step 1):
# wss://${WS_HOST}/v1/realtime?model=kupe-realtime&client_secret=SECRET

# 3) After connect, send a text turn then ask for a response:
# {"type":"conversation.item.create","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"Remind them their EMI is due tomorrow."}]}}
# {"type":"response.create"}`;
  }
}

function maskApiKey(prefix: string, fullKey?: string | null, revealed?: boolean): string {
  if (revealed && fullKey) return fullKey;
  const base = (fullKey ?? prefix).slice(0, Math.max(prefix.length, 12));
  return `${base}${"•".repeat(Math.max(16, 28 - base.length))}`;
}

/** Key string embedded in snippets: full when copyable, else prefix (still copyable). */
function snippetApiKey(prefix: string | null | undefined, fullKey: string | null): string {
  if (fullKey) return fullKey;
  if (prefix) return prefix;
  return "sk-kupe-YOUR_KEY";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightCode(code: string, lang: SdkLang): string {
  const esc = escapeHtml(code);

  if (lang === "curl") {
    return esc
      .replace(/(^|\n)(#.*)/g, '$1<span class="tok-comment">$2</span>')
      .replace(/\b(curl)\b/g, '<span class="tok-fn">$1</span>')
      .replace(/(-[A-Za-z]+)/g, '<span class="tok-attr">$1</span>')
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="tok-string">$1</span>')
      .replace(/\b(Authorization|Content-Type|Bearer)\b/g, '<span class="tok-type">$1</span>')
      .replace(/(https?:\/\/[^\s\\]+|wss?:\/\/[^\s\\]+)/g, '<span class="tok-string">$1</span>');
  }

  if (lang === "python") {
    return esc
      .replace(/(#.*)$/gm, '<span class="tok-comment">$1</span>')
      .replace(
        /\b(import|from|as|def|return|if|elif|else|pass|True|False|None|f)\b/g,
        '<span class="tok-keyword">$1</span>',
      )
      .replace(/\b(print|json|OpenAI|WebSocketApp|dumps|loads|get)\b/g, '<span class="tok-fn">$1</span>')
      .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g, '<span class="tok-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
  }

  // typescript / javascript
  return esc
    .replace(/(\/\/.*)$/gm, '<span class="tok-comment">$1</span>')
    .replace(
      /\b(import|from|const|let|var|await|async|new|return|if|else|typeof|export|default)\b/g,
      '<span class="tok-keyword">$1</span>',
    )
    .replace(/\b(OpenAI|WebSocket|JSON|console|String)\b/g, '<span class="tok-type">$1</span>')
    .replace(/\b(post|send|stringify|parse|log|onopen|onmessage)\b/g, '<span class="tok-fn">$1</span>')
    .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g, '<span class="tok-string">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
}

const LANG_LABEL: Record<SdkLang, string> = {
  typescript: "TypeScript",
  python: "Python",
  curl: "cURL",
};

const MATRIX_GAP = 2.4;
const MATRIX_DOT = 4.6;

function emptyFrame(rows: number, cols: number): Frame {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function stampSoft(frame: Frame, row: number, col: number, radius: number, peak: number) {
  const rows = frame.length;
  const cols = frame[0]?.length ?? 0;
  const r0 = Math.floor(row - radius);
  const r1 = Math.ceil(row + radius);
  const c0 = Math.floor(col - radius);
  const c1 = Math.ceil(col + radius);
  for (let r = r0; r <= r1; r++) {
    if (r < 0 || r >= rows) continue;
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= cols) continue;
      const d = Math.hypot(r - row, c - col);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const value = peak * falloff * falloff;
      frame[r]![c] = Math.max(frame[r]![c]!, value);
    }
  }
}

/** Continuous galaxy arms + ant-colony trails — sparse, organic, animated. */
function buildColonyFrames(rows: number, cols: number, count = 36): Frame[] {
  const frames: Frame[] = [];
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxR = Math.min(rows, cols) * 0.46;
  const arms = 3;
  const colonies = [
    { x: cols * 0.22, y: rows * 0.28, drift: 0.9 },
    { x: cols * 0.74, y: rows * 0.62, drift: 1.15 },
    { x: cols * 0.38, y: rows * 0.78, drift: 0.75 },
  ];

  for (let f = 0; f < count; f++) {
    const phase = (f / count) * Math.PI * 2;
    const frame = emptyFrame(rows, cols);

    // Spiral galaxy arms
    for (let arm = 0; arm < arms; arm++) {
      const armOffset = (arm / arms) * Math.PI * 2;
      for (let i = 0; i < 42; i++) {
        const t = i / 41;
        const angle = t * Math.PI * 3.4 + armOffset + phase * 0.55;
        const radius = t * maxR;
        const wobble = Math.sin(t * 9 + phase * 1.4 + arm) * (0.6 + t * 1.1);
        const r = cy + Math.sin(angle) * radius + Math.cos(angle * 2) * wobble * 0.35;
        const c = cx + Math.cos(angle) * radius + Math.sin(angle * 2) * wobble * 0.35;
        const peak = 0.35 + (1 - t) * 0.55;
        stampSoft(frame, r, c, 1.15 + (1 - t) * 0.55, peak);
      }
    }

    // Soft galactic core
    stampSoft(frame, cy, cx, 2.8, 0.85);
    stampSoft(frame, cy + Math.sin(phase) * 0.4, cx + Math.cos(phase) * 0.4, 1.6, 1);

    // Ant-colony clusters with continuous trails
    for (let ci = 0; ci < colonies.length; ci++) {
      const colony = colonies[ci]!;
      const ox = colony.x + Math.sin(phase * colony.drift + ci * 1.7) * (cols * 0.08);
      const oy = colony.y + Math.cos(phase * colony.drift * 0.85 + ci) * (rows * 0.07);
      stampSoft(frame, oy, ox, 2.2, 0.9);

      // Trail of ants walking in a loop from colony toward core
      for (let s = 0; s < 18; s++) {
        const u = s / 17;
        const bend = Math.sin(u * Math.PI * 2 + phase + ci) * 1.8;
        const r = oy * (1 - u) + cy * u + bend * 0.45;
        const c = ox * (1 - u) + cx * u + Math.cos(u * Math.PI * 3 + phase) * bend * 0.35;
        stampSoft(frame, r, c, 0.95, 0.35 + (1 - u) * 0.4);
      }
    }

    // Sparse dust — only a few extra spark dots near arms
    for (let d = 0; d < 8; d++) {
      const a = phase * 0.7 + d * 0.9;
      const rad = maxR * (0.35 + ((d * 17) % 10) / 18);
      stampSoft(
        frame,
        cy + Math.sin(a) * rad,
        cx + Math.cos(a * 1.1) * rad,
        0.85,
        0.45 + (d % 3) * 0.12,
      );
    }

    frames.push(frame);
  }
  return frames;
}

export function KupeRealtimeApiHero({ className }: { className?: string }) {
  const [activeKey, setActiveKey] = useState<VoiceApiKey | null>(null);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [loadingKey, setLoadingKey] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [lang, setLang] = useState<SdkLang>("typescript");
  const [matrixGrid, setMatrixGrid] = useState({ rows: 36, cols: 14, size: MATRIX_DOT });
  const [matrixFrames, setMatrixFrames] = useState<Frame[]>(() => buildColonyFrames(36, 14));
  const matrixPanelRef = useRef<HTMLDivElement>(null);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const el = matrixPanelRef.current;
    if (!el) return;

    const sync = (width: number, height: number) => {
      if (width < 8 || height < 8) return;
      const size = MATRIX_DOT;
      // Slightly fewer cells than a full fill — roomier continuous patterns
      const cols = Math.max(10, Math.ceil((width + MATRIX_GAP) / (size + MATRIX_GAP)));
      const rows = Math.max(16, Math.ceil((height + MATRIX_GAP) / (size + MATRIX_GAP)));
      setMatrixGrid((prev) => {
        if (prev.rows === rows && prev.cols === cols && prev.size === size) return prev;
        setMatrixFrames(buildColonyFrames(rows, cols));
        return { rows, cols, size };
      });
    };

    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) sync(box.width, box.height);
    });
    ro.observe(el);
    sync(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const ensureKey = useCallback(async (createIfMissing: boolean) => {
    setLoadingKey(true);
    try {
      const keys = await listVoiceApiKeys();
      if (keys.length > 0) {
        const latest = [...keys].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0]!;
        setActiveKey(latest);
        return latest;
      }
      if (createIfMissing) {
        const row = await createVoiceApiKey(`Deploy key ${new Date().toLocaleDateString()}`);
        setActiveKey(row);
        if (row.key) {
          setFullKey(row.key);
          setKeyRevealed(true);
        }
        return row;
      }
      return null;
    } catch {
      toast.error("Couldn't load API keys");
      return null;
    } finally {
      setLoadingKey(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void ensureKey(true);
  }, [ensureKey]);

  async function generateKey() {
    setGenerating(true);
    try {
      const row = await createVoiceApiKey(`Deploy key ${new Date().toLocaleDateString()}`);
      setActiveKey(row);
      if (row.key) {
        setFullKey(row.key);
        setKeyRevealed(true);
        void navigator.clipboard.writeText(row.key);
        toast.message("API key generated", { description: "Copied to clipboard — store it securely." });
      }
    } catch {
      toast.error("Couldn't generate API key");
    } finally {
      setGenerating(false);
    }
  }

  const displayKeyLiteral = snippetApiKey(
    activeKey ? maskApiKey(activeKey.key_prefix, fullKey, false) : null,
    null,
  );
  const copyKeyLiteral = snippetApiKey(activeKey?.key_prefix, fullKey);

  const displaySnippet = useMemo(
    () => buildSnippet(lang, displayKeyLiteral),
    [lang, displayKeyLiteral],
  );
  const copySnippet = useMemo(() => buildSnippet(lang, copyKeyLiteral), [lang, copyKeyLiteral]);
  const highlighted = useMemo(() => highlightCode(displaySnippet, lang), [displaySnippet, lang]);

  async function copyCode() {
    await navigator.clipboard.writeText(copySnippet);
    setCopiedCode(true);
    toast.message("Copied SDK snippet", {
      description: fullKey
        ? "Includes your full API key — keep it private."
        : activeKey
          ? "Uses your key prefix — generate a key to embed the full secret."
          : undefined,
    });
    window.setTimeout(() => setCopiedCode(false), 1600);
  }

  async function copyKey() {
    const value = fullKey ?? activeKey?.key_prefix ?? "";
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(true);
    if (!fullKey) {
      toast.message("Copied key prefix", {
        description: "Generate a new key to copy the full secret.",
      });
    } else {
      toast.message("Copied API key");
    }
    window.setTimeout(() => setCopiedKey(false), 1600);
  }

  const displayKey = activeKey
    ? maskApiKey(activeKey.key_prefix, fullKey, keyRevealed)
    : loadingKey
      ? "Loading key…"
      : "No key yet";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-card shadow-elevated",
        className,
      )}
    >
      <div className="relative grid min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.58fr)]">
        {/* Left — content */}
        <div className="flex min-h-0 flex-col p-6 md:p-8 lg:pr-6 lg:border-r lg:border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="group/nav rounded-full">
                  Set up for AI coding tool
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() =>
                    toast.message("Cursor setup (demo)", { description: "Prompt pack copied." })
                  }
                >
                  Cursor
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast.message("Claude Code setup (demo)")}>
                  Claude Code
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast.message("Codex setup (demo)")}>
                  Codex
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => void generateKey()}
              loading={generating}
            >
              Generate API key
            </Button>
          </div>

          <div className="mt-8 flex items-start gap-3 text-left">
            <BrandMark size={44} className="rounded-xl shadow-sm ring-1 ring-border/60" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Kupe Realtime API</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                OpenAI SDK · baseURL {API_BASE_URL}/v1 · model{" "}
                <span className="font-mono text-foreground/80">kupe-realtime</span>
              </p>
            </div>
          </div>

          {/* API key */}
          <div className="mt-6 w-full max-w-xl text-left">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              API key
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-muted/35 px-3 py-2.5 font-mono text-xs tracking-tight">
                {displayKey}
              </code>
              <div className="flex shrink-0 items-center gap-1">
                {fullKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={keyRevealed ? "Hide API key" : "Reveal API key"}
                    onClick={() => setKeyRevealed((v) => !v)}
                  >
                    {keyRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="Copy API key"
                  disabled={!activeKey}
                  onClick={() => void copyKey()}
                >
                  {copiedKey ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
            {!fullKey && activeKey ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Showing prefix only — generate a new key to reveal the full secret once.
              </p>
            ) : null}
          </div>

          {/* Code snippet */}
          <div className="mt-5 w-full max-w-xl text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {LANG_LABEL[lang]} · OpenAI SDK
              </p>
              <div className="flex items-center gap-1.5">
                <Tabs value={lang} onValueChange={(v) => setLang(v as SdkLang)}>
                  <TabsList variant="line" className="h-7">
                    {(Object.keys(LANG_LABEL) as SdkLang[]).map((id) => (
                      <TabsTrigger key={id} value={id} className="px-2 text-[11px]">
                        {LANG_LABEL[id]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
                  onClick={() => void copyCode()}
                >
                  {copiedCode ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
              </div>
            </div>
            <div className="sdk-code mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-muted/25 shadow-inner">
              <pre
                className="p-4 font-mono text-[11px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </div>
          </div>

          <Link
            to="/deploy-with-code/apis/kupe-realtime-api"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            View full API docs
          </Link>
        </div>

        {/* Right — sparse galaxy / ant-colony pattern (dots only, transparent) */}
        <div
          ref={matrixPanelRef}
          aria-hidden
          className="relative hidden self-stretch overflow-hidden bg-transparent lg:block"
        >
          <Matrix
            rows={matrixGrid.rows}
            cols={matrixGrid.cols}
            frames={matrixFrames}
            fps={6}
            autoplay
            loop
            size={matrixGrid.size}
            gap={MATRIX_GAP}
            showOffDots
            offOpacity={0.38}
            palette={{
              on: "var(--primary)",
              off: "color-mix(in oklab, var(--muted-foreground) 55%, transparent)",
            }}
            className="absolute inset-0"
            ariaLabel="Animated galaxy matrix"
          />
        </div>
      </div>

      <style>{`
        .sdk-code .tok-keyword { color: #7c6af5; }
        .sdk-code .tok-string { color: #2f9e74; }
        .sdk-code .tok-fn { color: #3b82f6; }
        .sdk-code .tok-type { color: #db7c3d; }
        .sdk-code .tok-number { color: #c26d2b; }
        .sdk-code .tok-comment { color: var(--muted-foreground); opacity: 0.85; }
        .sdk-code .tok-attr { color: #7c6af5; }
        .dark .sdk-code .tok-keyword { color: #a5b4fc; }
        .dark .sdk-code .tok-string { color: #6ee7b7; }
        .dark .sdk-code .tok-fn { color: #93c5fd; }
        .dark .sdk-code .tok-type { color: #fdba74; }
        .dark .sdk-code .tok-number { color: #fbbf24; }
        .dark .sdk-code .tok-attr { color: #c4b5fd; }
      `}</style>
    </section>
  );
}
