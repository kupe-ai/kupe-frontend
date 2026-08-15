"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Check, ChevronDown, Copy, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { VoicePageHeader } from "@/components/voice-agents/shared";
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

export default function VoiceAgentsDeployCodePage() {
  const navigate = useNavigate();
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
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
      <VoicePageHeader
        title="Deploy with code"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate("/voice-agents/settings")}>
              <KeyRound className="size-3.5" />
              API keys
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                navigate("/voice-agents/deploy-with-code/recipes/moengage")
              }
            >
              <BookOpen className="size-3.5" />
              Read docs
            </Button>
          </div>
        }
      />

      <section className="mt-14 flex flex-col items-center text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Build voice agents with code
        </h1>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full">
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
          <Button className="rounded-full" onClick={() => void generateKey()} disabled={generating}>
            <Sparkles className="size-3.5" />
            {generating ? "Generating…" : "Generate API key"}
          </Button>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Deploy with APIs</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPLOY_API_CARDS.map((card) => (
            <Link
              key={card.slug}
              to={`/voice-agents/deploy-with-code/apis/${card.slug}`}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
            >
              <AsciiIcon kind={card.kind} tone={card.tone} size="md" />
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
              navigate("/voice-agents/deploy-with-code/recipes/moengage")
            }
          >
            Browse all
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {DEPLOY_RECIPES.map((r) => (
            <li key={r.slug}>
              <Link
                to={`/voice-agents/deploy-with-code/recipes/${r.slug}`}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your API key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This key is shown once. Copy it now and store it securely.</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{revealedKey}</code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full"
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
