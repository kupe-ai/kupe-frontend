"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/wordmark";
import { AiStar } from "@/components/brand/ai-star";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Matrix } from "@/components/ui/matrix";
import { API_BASE_URL } from "@/lib/voice-deploy-data";
import { createVoiceApiKey, listVoiceApiKeys } from "@/lib/api/voice/api-keys";
import type { VoiceApiKey } from "@/lib/api/voice/types";
import { cn } from "@/lib/utils";

const SDK_SNIPPET = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.KUPE_API_KEY,
  baseURL: "${API_BASE_URL}/v1",
});

const session = await client.beta.realtime.sessions.create({
  model: "kupe-realtime",
  agent_id: "agt_...",
  voice: "priya",
});

// session.client_secret.value → connect wss://${API_BASE_URL.replace("https://", "")}/v1/realtime`;

function maskApiKey(prefix: string, fullKey?: string | null, revealed?: boolean): string {
  if (revealed && fullKey) return fullKey;
  const base = fullKey ? fullKey.slice(0, 12) : prefix;
  return `${base}${"•".repeat(Math.max(16, 28 - base.length))}`;
}

function OpenAiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-3.5 shrink-0 opacity-70", className)} aria-hidden>
      <path
        fill="currentColor"
        d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.739-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.453 8.033a4.476 4.476 0 0 1 2.365-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.19 13.617a4.5 4.5 0 0 1-1.737-5.584Zm16.073 3.855-5.835-3.387 2.02-1.163a.075.075 0 0 1 .071 0l4.83 2.786a4.494 4.494 0 0 1-.672 8.08v-5.678a.79.79 0 0 0-.414-.638Zm2.028-3.031-.141-.085-4.78-2.792a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.287 4.808ZM8.32 12.864l-2.02-1.164a.08.08 0 0 1-.038-.056V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681Zm1.098-2.273L12 8.88l2.583 1.711v3.42L12 15.53l-2.583-1.711Z"
      />
    </svg>
  );
}

export function KupeRealtimeApiHero({ className }: { className?: string }) {
  const [activeKey, setActiveKey] = useState<VoiceApiKey | null>(null);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [loadingKey, setLoadingKey] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [wavePhase, setWavePhase] = useState(0);
  const bootstrappedRef = useRef(false);

  const waveLevels = useMemo(() => {
    const cols = 28;
    return Array.from({ length: cols }, (_, i) => {
      const colPhase = (i / cols) * Math.PI * 2;
      const primary = (Math.sin(wavePhase + colPhase) + 1) / 2;
      const secondary = (Math.sin(wavePhase * 1.4 + colPhase * 0.7 + 1.2) + 1) / 2;
      return 0.12 + primary * 0.55 + secondary * 0.25;
    });
  }, [wavePhase]);

  useEffect(() => {
    const id = window.setInterval(() => setWavePhase((p) => p + 0.22), 80);
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

  async function copyCode() {
    await navigator.clipboard.writeText(SDK_SNIPPET);
    setCopiedCode(true);
    toast.message("Copied SDK snippet");
    window.setTimeout(() => setCopiedCode(false), 1600);
  }

  async function copyKey() {
    const value = fullKey ?? activeKey?.key_prefix ?? "";
    if (!value) return;
    await navigator.clipboard.writeText(fullKey ?? value);
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
      {/* Right-side theme gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[min(52%,28rem)]"
      >
        <div className="absolute inset-0 kupe-theme-gradient opacity-[0.14] dark:opacity-[0.22]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_22%,color-mix(in_oklab,var(--kupe-hero)_28%,transparent),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_100%_22%,color-mix(in_oklab,var(--kupe-hero)_42%,transparent),transparent_64%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_88%_92%,color-mix(in_oklab,var(--kupe-hero-soft)_18%,transparent),transparent_72%)]" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="relative grid min-h-[28rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* Left column — content + matrix waves in lower half */}
        <div className="flex min-h-0 flex-col p-6 md:p-8 lg:pr-6">
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
              {!generating && <AiStar size={14} />}
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

          {/* API key row */}
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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <OpenAiMark />
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  OpenAI SDK
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
                onClick={() => void copyCode()}
              >
                {copiedCode ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <OpenAiMark className="size-3 opacity-80" />
                Copy
              </Button>
            </div>
            <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-border bg-muted/25 shadow-inner">
              <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
                {SDK_SNIPPET}
              </pre>
            </div>
          </div>

          <Link
            to="/deploy-with-code/apis/kupe-realtime-api"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View full API docs
            <Sparkles className="size-3.5 opacity-70" />
          </Link>

          {/* Matrix voice waves — left second half */}
          <div className="relative mt-auto flex min-h-[9rem] items-end pt-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary/8 via-primary/3 to-transparent dark:from-primary/14"
            />
            <Matrix
              rows={9}
              cols={28}
              mode="vu"
              levels={waveLevels}
              size={3.2}
              gap={1.1}
              showOffDots
              palette={{ on: "var(--primary)", off: "color-mix(in oklab, var(--muted-foreground) 28%, transparent)" }}
              className="relative w-full opacity-90"
              ariaLabel="Animated voice waveform"
            />
          </div>
        </div>

        {/* Right column — decorative gradient panel (visible on large screens) */}
        <div
          aria-hidden
          className="relative hidden min-h-[18rem] overflow-hidden lg:block"
        >
          <div className="absolute inset-6 rounded-[1.75rem] kupe-theme-gradient opacity-[0.18] blur-2xl dark:opacity-[0.28]" />
          <div className="absolute inset-10 rounded-[1.5rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 top-16 rounded-2xl kupe-hero-fill opacity-[0.12] dark:opacity-[0.18]" />
        </div>
      </div>
    </section>
  );
}
