"use client";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DeployBreadcrumb } from "@/components/voice-agents/deploy-breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useKoriQuery } from "@/lib/hooks/use-kori-query";
import { getDeployApi } from "@/lib/voice-deploy-data";
import { listVoiceAgents } from "@/lib/api/voice/agents";

export default function DeployApiDetailPage() {
  const { slug = "" } = useParams();
  const api = getDeployApi(slug);
  const [tab, setTab] = useState(api?.curlTabs[0]?.id ?? "");
  const [agentId, setAgentId] = useState("");
  const [connection, setConnection] = useState("");

  const agentsQuery = useKoriQuery({
    queryKey: ["voice-agents", "deploy-picker"],
    queryFn: () => listVoiceAgents({ page_size: 100 }),
  });

  useEffect(() => {
    document.title = api
      ? `${api.title} · Deploy with code · Kupe`
      : "Deploy with code · Kupe";
    setTab(api?.curlTabs[0]?.id ?? "");
  }, [api]);

  useEffect(() => {
    const first = agentsQuery.data?.items?.[0];
    if (first && !agentId) setAgentId(first.id);
  }, [agentsQuery.data, agentId]);

  if (!api) {
    return (
      <div className="px-6 py-8 text-sm text-muted-foreground">
        API guide not found.{" "}
        <Link to="/voice-agents/deploy-with-code" className="underline">
          Back
        </Link>
      </div>
    );
  }

  const activeCode =
    api.curlTabs.find((t) => t.id === tab)?.code ?? api.curlTabs[0]?.code ?? "";
  const agents = agentsQuery.data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
      <DeployBreadcrumb
        section="apis"
        sectionLabel="APIs"
        currentSlug={api.slug}
        currentTitle={api.title}
      />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{api.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{api.headline}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {api.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void navigator.clipboard.writeText(activeCode);
              toast.message("Prompt / snippet copied");
            }}
          >
            <Copy className="size-3.5" />
            Copy prompt
          </Button>
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/voice-agents/deploy-with-code/recipes/moengage">
              View docs
            </Link>
          </Button>
        </div>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr]">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Quickstart</p>
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={agentsQuery.isLoading ? "Loading…" : "Select an agent"} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agentsQuery.isLoading ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Loading agents…
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Version</Label>
            <button
              type="button"
              disabled
              className="flex h-8 w-full cursor-not-allowed items-center rounded-lg border border-input px-2.5 text-sm text-muted-foreground opacity-60"
            >
              Version
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Connection</Label>
            <Select value={connection} onValueChange={setConnection}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kori-main">Kupe main line</SelectItem>
                <SelectItem value="kori-support">Kupe support</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Phone number</Label>
            <button
              type="button"
              disabled
              className="flex h-8 w-full cursor-not-allowed items-center rounded-lg border border-input px-2.5 text-sm text-muted-foreground opacity-70"
            >
              {connection ? "Select a number" : "Select a connection first"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {api.curlTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    tab === t.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => {
                void navigator.clipboard.writeText(activeCode);
                toast.message("Copied");
              }}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
            {activeCode}
          </pre>
        </div>
      </section>

      <section className="mt-8 pb-10">
        <h2 className="text-base font-semibold">About {api.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {api.about}
        </p>
      </section>
    </div>
  );
}
