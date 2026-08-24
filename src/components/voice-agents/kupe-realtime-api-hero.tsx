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
import { Matrix } from "@/components/ui/matrix";
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

export function KupeRealtimeApiHero({ className }: { className?: string }) {
  const [activeKey, setActiveKey] = useState<VoiceApiKey | null>(null);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [loadingKey, setLoadingKey] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [lang, setLang] = useState<SdkLang>("typescript");
  const [wavePhase, setWavePhase] = useState(0);
  const bootstrappedRef = useRef(false);

  const waveLevels = useMemo(() => {
    const cols = 26;
    return Array.from({ length: cols }, (_, i) => {
      const colPhase = (i / cols) * Math.PI * 2.4;
      const primary = (Math.sin(wavePhase + colPhase) + 1) / 2;
      const secondary = (Math.sin(wavePhase * 1.45 + colPhase * 0.75 + 1.1) + 1) / 2;
      // Pair columns into thicker bars (like image 2 voice waves)
      const barBoost = i % 2 === 0 ? 0.08 : 0;
      return 0.08 + primary * 0.62 + secondary * 0.22 + barBoost;
    });
  }, [wavePhase]);

  useEffect(() => {
    const id = window.setInterval(() => setWavePhase((p) => p + 0.2), 80);
    return () => window.clearInterval(id);
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
      <div className="relative grid min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)]">
        {/* Left — content */}
        <div className="flex min-h-0 flex-col p-6 md:p-8 lg:pr-4">
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

        {/* Right — big transparent voice-wave matrix (dots only) */}
        <div
          aria-hidden
          className="relative hidden min-h-[22rem] items-center justify-center bg-transparent px-4 py-8 lg:flex"
        >
          <Matrix
            rows={14}
            cols={26}
            mode="vu"
            levels={waveLevels}
            size={5.5}
            gap={1.8}
            showOffDots
            palette={{
              on: "var(--primary)",
              off: "color-mix(in oklab, var(--muted-foreground) 34%, transparent)",
            }}
            className="opacity-95"
            ariaLabel="Animated voice wave matrix"
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
