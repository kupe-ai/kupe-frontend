"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Pencil, Sparkles, XIcon } from "lucide-react";
import { PetSprite } from "@/components/pets/pet-sprite";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import { TestAgentCallDialog } from "@/components/voice-agents/test-agent-call-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createVoiceAgent } from "@/lib/api/voice/agents";
import type { VoiceAgentTemplate } from "@/lib/voice-agents-data";
import type { ReactNode } from "react";

function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "tools" | "vars";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "muted" && "bg-muted text-foreground",
        tone === "tools" && "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
        tone === "vars" && "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
      )}
    >
      {children}
    </span>
  );
}

export function TemplateAgentDialog({
  template,
  open,
  onOpenChange,
}: {
  template: VoiceAgentTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"about" | "configurations">("about");
  const [testOpen, setTestOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("about");
      setCreatedId(null);
    }
  }, [open, template?.id]);

  async function ensureAgent() {
    if (createdId) return createdId;
    if (!template) throw new Error("No template");
    setCreating(true);
    try {
      const agent = await createVoiceAgent({
        template_id: template.id,
        name: template.name,
        system_prompt: `${template.about}\n\n${template.scenario}`,
      });
      setCreatedId(agent.id);
      return agent.id;
    } catch {
      toast.error("Couldn't create agent from template");
      throw new Error("create failed");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (open) setTab("about");
  }, [open, template?.id]);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">{template.name}</DialogTitle>
        <div className="grid max-h-[min(88vh,720px)] min-h-[480px] grid-cols-1 md:grid-cols-2">
          {/* Left — test pane */}
          <div className="flex flex-col bg-muted/40 p-5 md:border-r md:border-border">
            <p className="text-sm font-medium text-foreground">Test Agent</p>
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
              <BarVisualizer
                demo
                state="listening"
                barCount={15}
                className="w-full max-w-[220px] bg-transparent p-0"
              />
              <p className="text-sm text-muted-foreground">
                Start a call to test the agent
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full rounded-full"
              disabled={creating}
              onClick={() => {
                void ensureAgent().then(() => setTestOpen(true));
              }}
            >
              <Phone className="size-4" />
              Call agent
            </Button>
          </div>

          {/* Right — details */}
          <div className="relative flex min-h-0 flex-col bg-background p-5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </Button>

            <div className="pr-8">
              <PetSprite seed={template.seed} size={36} frame="stand" />
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                {template.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Created by {template.createdBy} · {template.callsCompleted}{" "}
                calls completed
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-full"
                disabled={creating}
                onClick={() => {
                  void ensureAgent().then((id) => {
                    onOpenChange(false);
                    navigate(`/voice-agents/agents/${id}`);
                  });
                }}
              >
                <Pencil className="size-3.5" />
                Edit agent
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                disabled={creating}
                onClick={() => {
                  void ensureAgent().then((id) => {
                    onOpenChange(false);
                    navigate(`/voice-agents/agents/${id}`);
                  });
                }}
              >
                <Sparkles className="size-3.5" />
                Customise with AI
              </Button>
            </div>

            <div className="mt-5 flex gap-4 border-b border-border">
              {(
                [
                  ["about", "About"],
                  ["configurations", "Configurations"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "border-b-2 pb-2 text-sm transition-colors",
                    tab === id
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === "about" ? (
                <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
                  <p>{template.about}</p>
                  <div>
                    <p className="font-semibold">Scenario:</p>
                    <p className="mt-1 text-muted-foreground">
                      {template.scenario}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">
                      Supported languages
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {template.languages.map((lang) => (
                        <Chip key={lang}>{lang}</Chip>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Tools</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {template.tools.map((tool) => (
                        <Chip key={tool} tone="tools">
                          {tool}
                        </Chip>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Variables</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {template.variables.map((variable) => (
                        <Chip key={variable} tone="vars">
                          {variable}
                        </Chip>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <TestAgentCallDialog
        open={testOpen && Boolean(createdId)}
        onOpenChange={setTestOpen}
        agentId={createdId ?? ""}
        agentName={template.name}
        seed={template.seed}
      />
    </Dialog>
  );
}
