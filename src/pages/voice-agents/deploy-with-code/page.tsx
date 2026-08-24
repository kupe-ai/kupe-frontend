"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { ModernIcon } from "@/components/icons/modern-icon";
import { AiStar } from "@/components/brand/ai-star";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEPLOY_API_CARDS, DEPLOY_RECIPES } from "@/lib/voice-deploy-data";
import { createVoiceApiKey } from "@/lib/api/voice/api-keys";
import { useSettingsDialogOptional } from "@/components/settings/settings-dialog-context";

export default function VoiceAgentsDeployCodePage() {
  const navigate = useNavigate();
  const settings = useSettingsDialogOptional();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    document.title = "Deploy with code · Voice Agents · Kupe";
  }, []);

  async function generateKey() {
    setGenerating(true);
    try {
      const row = await createVoiceApiKey(`Deploy key ${new Date().toLocaleDateString()}`);
      if (row.key) {
        setRevealedKey(row.key);
        void navigator.clipboard.writeText(row.key);
        toast.message("API key generated", { description: "Copied to clipboard — store it securely." });
      }
    } catch {
      toast.error("Couldn't generate API key");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="voice-page">
      <VoicePageHeader
        title="Deploy with code"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="group/nav rounded-full"
              onClick={() => {
                if (!settings?.openSettings("keys")) {
                  navigate("/settings");
                }
              }}
            >
              <ModernIcon name="key" className="size-3.5" />
              API keys
            </Button>
            <Button
              variant="outline"
              className="group/nav rounded-full"
              onClick={() =>
                navigate("/deploy-with-code/recipes/moengage")
              }
            >
              <ModernIcon name="book" className="size-3.5" />
              Read docs
            </Button>
          </div>
        }
      />

      <section className="mt-14 flex flex-col items-center text-center">
        <h1 className="text-display">
          Build voice agents with code
        </h1>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="group/nav rounded-full">
                Set up for AI coding tool
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem
                onSelect={() =>
                  toast.message("Cursor setup (demo)", {
                    description: "Prompt pack copied.",
                  })
                }
              >
                Cursor
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => toast.message("Claude Code setup (demo)")}
              >
                Claude Code
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => toast.message("Codex setup (demo)")}
              >
                Codex
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="rounded-full" onClick={() => void generateKey()} loading={generating}>
            {!generating && <AiStar size={14} />}
            Generate API key
          </Button>
        </div>
      </section>

      <section className="mt-14">
        <Link
          to="/deploy-with-code/apis/kupe-realtime-api"
          className="block rounded-2xl border border-border bg-card p-6 shadow-elevated hover:bg-muted/20"
        >
          <div className="flex flex-col items-center text-center">
            <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.739-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.453 8.033a4.476 4.476 0 0 1 2.365-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.19 13.617a4.5 4.5 0 0 1-1.737-5.584Zm16.073 3.855-5.835-3.387 2.02-1.163a.075.075 0 0 1 .071 0l4.83 2.786a4.494 4.494 0 0 1-.672 8.08v-5.678a.79.79 0 0 0-.414-.638Zm2.028-3.031-.141-.085-4.78-2.792a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.287 4.808ZM8.32 12.864l-2.02-1.164a.08.08 0 0 1-.038-.056V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681Zm1.098-2.273L12 8.88l2.583 1.711v3.42L12 15.53l-2.583-1.711Z"
              />
            </svg>
            <p className="mt-3 text-sm font-semibold">Kupe Realtime API</p>
            <p className="mt-1 text-sm text-muted-foreground">
              OpenAI SDK · baseURL https://x.kupe.in/v1 · model kupe-realtime
            </p>
            <pre className="mt-4 max-w-full overflow-x-auto rounded-xl border border-border bg-muted/30 p-4 text-left font-mono text-[11px] leading-relaxed">
{`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.KUPE_API_KEY,
  baseURL: "https://x.kupe.in/v1",
});`}
            </pre>
          </div>
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Deploy with APIs</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPLOY_API_CARDS.map((card) => (
            <Link
              key={card.slug}
              to={`/deploy-with-code/apis/${card.slug}`}
              className="group/nav pressable rounded-2xl border border-border bg-card p-5 shadow-elevated hover:bg-muted/20"
            >
              <AsciiIcon kind={card.kind} tone={card.tone} size="lg" />
              <h3 className="mt-3 text-sm font-semibold">{card.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 pb-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Recipes & Guides
          </h2>
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() =>
              navigate("/deploy-with-code/recipes/moengage")
            }
          >
            Browse all
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {DEPLOY_RECIPES.map((r) => (
            <li key={r.slug}>
              <Link
                to={`/deploy-with-code/recipes/${r.slug}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {r.summary}
                  </p>
                </div>
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={!!revealedKey} onOpenChange={(o) => !o && setRevealedKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your API key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This key is shown once. Copy it now and store it securely.</p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs break-all">
              {revealedKey}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-end rounded-full sm:self-auto"
              onClick={() => {
                if (revealedKey) void navigator.clipboard.writeText(revealedKey);
                toast.message("Copied");
              }}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button className="rounded-full" onClick={() => setRevealedKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
