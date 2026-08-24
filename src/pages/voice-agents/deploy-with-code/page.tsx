"use client";

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { KupeRealtimeApiHero } from "@/components/voice-agents/kupe-realtime-api-hero";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { ModernIcon } from "@/components/icons/modern-icon";
import { Button } from "@/components/ui/button";
import { DEPLOY_API_CARDS, DEPLOY_RECIPES } from "@/lib/voice-deploy-data";
import { DOCS_URL } from "@/config";
import { useSettingsDialogOptional } from "@/components/settings/settings-dialog-context";

export default function VoiceAgentsDeployCodePage() {
  const navigate = useNavigate();
  const settings = useSettingsDialogOptional();

  useEffect(() => {
    document.title = "Deploy with code · Voice Agents · Kupe";
  }, []);

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
            <Button variant="outline" className="group/nav rounded-full" asChild>
              <a href={DOCS_URL} target="_blank" rel="noreferrer">
                <ModernIcon name="book" className="size-3.5" />
                Read docs
              </a>
            </Button>
          </div>
        }
      />

      <section className="mt-10 text-left">
        <h1 className="text-display">Build voice agents with code</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Install the Kupe SDK or Kupe MCP, mint a realtime session, and start streaming voice from your browser, backend, or coding agent.
        </p>
      </section>

      <KupeRealtimeApiHero className="mt-8" />

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

    </div>
  );
}
