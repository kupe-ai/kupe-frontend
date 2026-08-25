"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, ChevronDown, Copy, Eye, EyeOff } from "lucide-react";
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
import { DOCS_URL } from "@/config";
import { API_BASE_URL, MCP_REMOTE_URL } from "@/lib/voice-deploy-data";
import { createVoiceApiKey, listVoiceApiKeys } from "@/lib/api/voice/api-keys";
import type { VoiceApiKey } from "@/lib/api/voice/types";
import { cn } from "@/lib/utils";

type SdkLang = "typescript" | "python" | "curl";
type CodingTool = "cursor" | "claude" | "codex";

const WS_HOST = API_BASE_URL.replace(/^https?:\/\//, "");
const SAMPLE_NAME = "Priya";
const SAMPLE_VOICE = "priya";
const SAMPLE_PROMPT = "You collect overdue EMIs. Be warm and brief.";
const SAMPLE_GREETING = "Hi, this is Priya from the bank.";
const MCP_STDIO_HINT =
  "Stdio fallback: uvx kupe-mcp with KUPE_API_KEY, or python -m app.server --mcp.";

/**
 * Snippets use the first-party Kupe SDK (pip install kupe / npm install kupe-sdk).
 * Paths always join as {base}/v1/... so the OpenAI absolute-path 404 cannot recur.
 */
function buildSnippet(lang: SdkLang, apiKey: string): string {
  switch (lang) {
    case "typescript":
      return `// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe({ apiKey: "${apiKey}" });
const session = await kupe.realtime.sessions.create({
  name: "${SAMPLE_NAME}",
  voice: "${SAMPLE_VOICE}",
  prompt: "${SAMPLE_PROMPT}",
  greeting: "${SAMPLE_GREETING}",
});
const rt = await kupe.realtime.connect(session);
rt.sendText("Hi Priya — remind this customer their EMI is due tomorrow.");
for await (const event of rt) {
  if (event.type === "response.output_audio_transcript.done") {
    console.log("agent:", event.transcript);
  }
}`;
    case "python":
      return `# pip install kupe
from kupe import Kupe

client = Kupe(api_key="${apiKey}")
session = client.realtime.sessions.create(
    name="${SAMPLE_NAME}",
    voice="${SAMPLE_VOICE}",
    prompt="${SAMPLE_PROMPT}",
    greeting="${SAMPLE_GREETING}",
)
with client.realtime.connect(session) as rt:
    rt.send_text("Hi Priya — remind this customer their EMI is due tomorrow.")
    for event in rt:
        if event.type == "response.output_audio_transcript.done":
            print("agent:", event.transcript)`;
    case "curl":
      return `# 1) Mint a session (returns client_secret + websocket_url)
curl -sS -X POST "${API_BASE_URL}/v1/realtime/sessions" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "${SAMPLE_NAME}",
    "voice": "${SAMPLE_VOICE}",
    "prompt": "${SAMPLE_PROMPT}",
    "greeting": "${SAMPLE_GREETING}"
  }'

# 2) Connect WebSocket (replace SECRET from step 1):
# wss://${WS_HOST}/agents/v1/realtime?model=kupe-realtime&client_secret=SECRET

# 3) After connect, send a text turn then ask for a response:
# {"type":"conversation.item.create","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"Remind them their EMI is due tomorrow."}]}}
# {"type":"response.create"}`;
  }
}

export function cursorMcpConfig(apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        kupe: {
          url: MCP_REMOTE_URL,
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2,
  );
}

function claudeCodeMcpConfig(apiKey: string): string {
  return `claude mcp add --transport http kupe ${MCP_REMOTE_URL} --header "Authorization: Bearer ${apiKey}"`;
}

function codexMcpConfig(apiKey: string): string {
  return `[mcp_servers.kupe]
url = "${MCP_REMOTE_URL}"
[mcp_servers.kupe.http_headers]
Authorization = "Bearer ${apiKey}"
`;
}

function mcpSetupPayload(tool: CodingTool, apiKey: string): { text: string; title: string } {
  switch (tool) {
    case "cursor":
      return { text: cursorMcpConfig(apiKey), title: "Copied Cursor MCP config" };
    case "claude":
      return { text: claudeCodeMcpConfig(apiKey), title: "Copied Claude Code MCP command" };
    case "codex":
      return { text: codexMcpConfig(apiKey), title: "Copied Codex MCP config" };
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

const SECRET_STORE_KEY = "kupe.deploy.apiKeySecrets";

function readSecretStore(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SECRET_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function rememberSecret(id: string, key: string) {
  try {
    const store = readSecretStore();
    store[id] = key;
    sessionStorage.setItem(SECRET_STORE_KEY, JSON.stringify(store));
  } catch {
    // private mode / quota — ignore
  }
}

function recallSecret(id: string): string | null {
  const value = readSecretStore()[id];
  return typeof value === "string" && value.startsWith("sk-") ? value : null;
}

function applyCreatedSecret(
  row: VoiceApiKey,
  setActiveKey: (k: VoiceApiKey) => void,
  setFullKey: (k: string) => void,
  setKeyRevealed: (v: boolean) => void,
) {
  setActiveKey(row);
  if (row.key) {
    rememberSecret(row.id, row.key);
    setFullKey(row.key);
    setKeyRevealed(true);
  }
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
        /\b(import|from|as|def|return|if|elif|else|pass|True|False|None|with|for|in|f)\b/g,
        '<span class="tok-keyword">$1</span>',
      )
      .replace(/\b(print|Kupe|connect|send_text)\b/g, '<span class="tok-fn">$1</span>')
      .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g, '<span class="tok-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
  }

  // typescript / javascript
  return esc
    .replace(/(\/\/.*)$/gm, '<span class="tok-comment">$1</span>')
    .replace(
      /\b(import|from|const|let|var|await|async|new|return|if|else|typeof|export|default|for|of)\b/g,
      '<span class="tok-keyword">$1</span>',
    )
    .replace(/\b(Kupe|JSON|console|String)\b/g, '<span class="tok-type">$1</span>')
    .replace(/\b(create|connect|sendText|log)\b/g, '<span class="tok-fn">$1</span>')
    .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g, '<span class="tok-string">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
}

const LANG_LABEL: Record<SdkLang, string> = {
  typescript: "TypeScript",
  python: "Python",
  curl: "cURL",
};

const MATRIX_GAP = 3.6;
const MATRIX_DOT = 5.8;

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

/** Three animated blue spiral galaxies — sparse, organic, drifting. */
function buildGalaxyFrames(rows: number, cols: number, count = 40): Frame[] {
  const frames: Frame[] = [];
  const galaxies = [
    { cx: cols * 0.28, cy: rows * 0.26, arms: 2, spin: 0.62, scale: 0.34, drift: 0.55 },
    { cx: cols * 0.72, cy: rows * 0.48, arms: 2, spin: -0.48, scale: 0.38, drift: 0.72 },
    { cx: cols * 0.42, cy: rows * 0.76, arms: 2, spin: 0.38, scale: 0.32, drift: 0.44 },
  ];

  for (let f = 0; f < count; f++) {
    const phase = (f / count) * Math.PI * 2;
    const frame = emptyFrame(rows, cols);

    for (let gi = 0; gi < galaxies.length; gi++) {
      const g = galaxies[gi]!;
      const maxR = Math.min(rows, cols) * g.scale;
      const gx = g.cx + Math.sin(phase * g.drift + gi * 2.1) * (cols * 0.04);
      const gy = g.cy + Math.cos(phase * g.drift * 0.85 + gi * 1.4) * (rows * 0.035);

      // Bright core
      stampSoft(frame, gy, gx, 3.2, 0.98);
      stampSoft(
        frame,
        gy + Math.sin(phase * g.spin * 1.2) * 0.35,
        gx + Math.cos(phase * g.spin * 1.2) * 0.35,
        2.1,
        1,
      );

      // Spiral arms per galaxy — thicker ribbons
      for (let arm = 0; arm < g.arms; arm++) {
        const armOffset = (arm / g.arms) * Math.PI * 2 + gi * 0.9;
        for (let i = 0; i < 28; i++) {
          const t = i / 27;
          const angle = t * Math.PI * 3.2 + armOffset + phase * g.spin;
          const radius = t * maxR;
          const wobble = Math.sin(t * 8 + phase * 1.3 + arm + gi) * (0.5 + t * 0.9);
          const r = gy + Math.sin(angle) * radius + Math.cos(angle * 2.1) * wobble * 0.3;
          const c = gx + Math.cos(angle) * radius + Math.sin(angle * 2.1) * wobble * 0.3;
          const peak = 0.38 + (1 - t) * 0.55;
          const armRadius = 1.85 + (1 - t) * 0.85;
          stampSoft(frame, r, c, armRadius, peak);
          const nx = Math.cos(angle + Math.PI / 2);
          const ny = Math.sin(angle + Math.PI / 2);
          stampSoft(frame, r + ny * 0.55, c + nx * 0.55, armRadius * 0.9, peak * 0.82);
          stampSoft(frame, r - ny * 0.55, c - nx * 0.55, armRadius * 0.9, peak * 0.82);
        }
      }

      // Sparse star dust around each galaxy
      for (let d = 0; d < 3; d++) {
        const a = phase * 0.65 + d * 1.15 + gi * 2.4;
        const rad = maxR * (0.45 + (d % 4) / 9);
        stampSoft(
          frame,
          gy + Math.sin(a) * rad,
          gx + Math.cos(a * 1.08) * rad,
          1.05,
          0.4 + (d % 2) * 0.14,
        );
      }
    }

    frames.push(frame);
  }
  return frames;
}

export function KupeRealtimeApiHero({
  className,
  compact = false,
}: {
  className?: string;
  /** Home-page tile: no galaxy panel, tighter chrome, don't mint a key until asked. */
  compact?: boolean;
}) {
  const [activeKey, setActiveKey] = useState<VoiceApiKey | null>(null);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [loadingKey, setLoadingKey] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [lang, setLang] = useState<SdkLang>("typescript");
  const [matrixGrid, setMatrixGrid] = useState({ rows: 28, cols: 11, size: MATRIX_DOT });
  const [matrixFrames, setMatrixFrames] = useState<Frame[]>(() => buildGalaxyFrames(28, 11));
  const matrixPanelRef = useRef<HTMLDivElement>(null);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (compact) return;
    const el = matrixPanelRef.current;
    if (!el) return;

    const sync = (width: number, height: number) => {
      if (width < 8 || height < 8) return;
      const size = MATRIX_DOT;
      // Slightly fewer cells — roomier continuous patterns
      const cols = Math.max(8, Math.ceil((width + MATRIX_GAP) / (size + MATRIX_GAP)));
      const rows = Math.max(12, Math.ceil((height + MATRIX_GAP) / (size + MATRIX_GAP)));
      setMatrixGrid((prev) => {
        if (prev.rows === rows && prev.cols === cols && prev.size === size) return prev;
        setMatrixFrames(buildGalaxyFrames(rows, cols));
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
  }, [compact]);

  const ensureKey = useCallback(async (createIfMissing: boolean) => {
    setLoadingKey(true);
    try {
      const keys = await listVoiceApiKeys();
      if (keys.length > 0) {
        const latest = [...keys].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0]!;
        setActiveKey(latest);
        const remembered = recallSecret(latest.id);
        if (remembered) setFullKey(remembered);
        return latest;
      }
      if (createIfMissing) {
        const row = await createVoiceApiKey(`Deploy key ${new Date().toLocaleDateString()}`);
        applyCreatedSecret(row, setActiveKey, setFullKey, setKeyRevealed);
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
    void ensureKey(!compact);
  }, [compact, ensureKey]);

  async function generateKey() {
    setGenerating(true);
    try {
      const row = await createVoiceApiKey(`Deploy key ${new Date().toLocaleDateString()}`);
      applyCreatedSecret(row, setActiveKey, setFullKey, setKeyRevealed);
      if (row.key) {
        void navigator.clipboard.writeText(row.key);
        toast.message("API key generated", { description: "Full key copied to clipboard — store it securely." });
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

  async function ensureFullSecret(): Promise<string | null> {
    if (fullKey) return fullKey;
    try {
      const row = await createVoiceApiKey(`Deploy key ${new Date().toLocaleDateString()}`);
      applyCreatedSecret(row, setActiveKey, setFullKey, setKeyRevealed);
      return row.key ?? null;
    } catch {
      toast.error("Couldn't create API key");
      return null;
    }
  }

  async function copyCode() {
    let snippet = copySnippet;
    if (!fullKey) {
      const secret = await ensureFullSecret();
      if (secret) snippet = buildSnippet(lang, secret);
    }
    await navigator.clipboard.writeText(snippet);
    setCopiedCode(true);
    toast.message("Copied SDK snippet", {
      description: "Includes your full API key — keep it private.",
    });
    window.setTimeout(() => setCopiedCode(false), 1600);
  }

  async function copyKey() {
    const secret = fullKey ?? (await ensureFullSecret());
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopiedKey(true);
    toast.message("Copied full API key");
    window.setTimeout(() => setCopiedKey(false), 1600);
  }

  async function copyCodingToolSetup(tool: CodingTool) {
    const secret = fullKey ?? (await ensureFullSecret());
    if (!secret) return;
    const { text, title } = mcpSetupPayload(tool, secret);
    await navigator.clipboard.writeText(text);
    toast.message(title, {
      description: `Includes your API key — keep it private. ${MCP_STDIO_HINT}`,
    });
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
      {compact ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_42%,transparent),transparent_70%)] opacity-80 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 h-28 w-36 opacity-[0.55]"
          >
            <Matrix
              rows={9}
              cols={12}
              mode="vu"
              levels={[0.2, 0.35, 0.55, 0.4, 0.7, 0.45, 0.3, 0.6, 0.25, 0.5, 0.35, 0.2]}
              size={3.2}
              gap={1.4}
              showOffDots
              offOpacity={0.12}
              palette={{
                on: "var(--primary)",
                off: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
              }}
              className="absolute top-3 right-3"
              ariaLabel=""
            />
          </div>
        </>
      ) : null}
      <div
        className={cn(
          "relative grid",
          compact
            ? "min-h-0"
            : "min-h-[22rem] sm:min-h-[26rem] lg:min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.58fr)]",
        )}
      >
        {/* Left — content */}
        <div
          className={cn(
            "relative z-[1] flex min-h-0 flex-col",
            compact ? "p-4 sm:p-5" : "p-5 sm:p-6 md:p-8 lg:border-r lg:border-border/60 lg:pr-6",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="group/nav rounded-full">
                  Install Kupe MCP
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => void copyCodingToolSetup("cursor")}>
                  Cursor
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void copyCodingToolSetup("claude")}>
                  Claude Code
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void copyCodingToolSetup("codex")}>
                  Codex
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/deploy-with-code/apis/kupe-mcp">Kupe MCP docs</Link>
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
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <a href={DOCS_URL} target="_blank" rel="noreferrer">
                <BookOpen className="size-3.5" />
                Read docs
              </a>
            </Button>
          </div>

          <div className={cn("flex items-start gap-3 text-left", compact ? "mt-5" : "mt-8")}>
            <BrandMark
              size={compact ? 36 : 44}
              className="rounded-xl shadow-sm ring-1 ring-border/60"
            />
            <div className="min-w-0">
              <h2
                className={cn(
                  "font-semibold tracking-tight",
                  compact ? "text-lg sm:text-xl" : "text-xl md:text-2xl",
                )}
              >
                Kupe Realtime API
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Kupe SDK · model{" "}
                <span className="font-mono text-foreground/80">kupe-realtime</span>
              </p>
            </div>
          </div>

          {/* API key */}
          <div className={cn("w-full text-left", compact ? "mt-4 max-w-none" : "mt-6 max-w-xl")}>
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
            {fullKey ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Copy pastes the full secret. Use reveal to show it once in this browser session.
              </p>
            ) : activeKey ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Prefix only — Copy or Generate creates a full secret you can paste.
              </p>
            ) : null}
          </div>

          {/* Code snippet */}
          <div className={cn("mt-5 w-full text-left", compact ? "max-w-none" : "max-w-xl")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {LANG_LABEL[lang]} · {lang === "curl" ? "HTTP" : "Kupe SDK"}
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
            <div
              className={cn(
                "sdk-code mt-2 overflow-auto rounded-xl border border-border bg-muted/25 shadow-inner",
                compact ? "max-h-44 sm:max-h-52 lg:max-h-56" : "max-h-56",
              )}
            >
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

        {/* Right — three animated blue galaxies on a subtle muted grid */}
        <div
          ref={matrixPanelRef}
          aria-hidden
          className={cn(
            "relative hidden self-stretch overflow-hidden bg-transparent",
            !compact && "lg:block",
          )}
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
            offOpacity={0.09}
            palette={{
              on: "var(--primary)",
              off: "color-mix(in oklab, var(--muted-foreground) 28%, transparent)",
            }}
            className="absolute inset-0"
            ariaLabel="Animated triple galaxy matrix"
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
