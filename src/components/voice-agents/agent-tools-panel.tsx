"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AudioLines,
  GripVertical,
  Link2,
  MessageCircleMore,
  MoreHorizontal,
  PhoneOff,
  Plus,
  Search,
  Trash2,
  Voicemail,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createAgentTool,
  deleteAgentTool,
  getSystemToolsState,
  listAgentTools,
  patchSystemToolsConfig,
  RESERVED_SYSTEM_TOOL_NAMES,
  setSystemToolEnabled,
  type AgentTool,
  type SystemNudge,
  type SystemTool,
  type SystemToolsState,
} from "@/lib/api/voice/agent-builder";
import {
  parameterHintForMethod,
  paramRowsToSchema,
  ToolParametersEditor,
  type ToolParamRow,
} from "@/components/voice-agents/tool-parameters-editor";
import { Textarea } from "@/components/ui/textarea";
import type { AutoCutMode, ThinkingSoundMode } from "@/types";

type ToolsTab = "system" | "custom";

const SYSTEM_ICONS: Record<SystemTool["name"], typeof PhoneOff> = {
  end_call: PhoneOff,
  voicemail: Voicemail,
  nudge: MessageCircleMore,
  thinking_sounds: AudioLines,
};

const THINKING_SOUND_HELP: Record<Exclude<ThinkingSoundMode, "off">, string> = {
  sounds: "Play a short hesitation in the agent's language (hmm, अं, ம்ம்) the moment the caller stops speaking.",
  words: "Acknowledge the caller in the agent's language (अच्छा, ठीक है, બરાબર, சரி, “got it”) instead of a hesitation sound.",
};

const AUTO_SAVE_MS = 600;

export function AgentToolsPanel({ agentId }: { agentId: string }) {
  const [tab, setTab] = useState<ToolsTab>("system");
  const [search, setSearch] = useState("");
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [system, setSystem] = useState<SystemToolsState | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef("");
  const readyRef = useRef(false);
  const systemRef = useRef(system);
  systemRef.current = system;

  const refresh = useCallback(async () => {
    try {
      const [custom, nextSystem] = await Promise.all([listAgentTools(agentId), getSystemToolsState(agentId)]);
      const reserved = new Set<string>(RESERVED_SYSTEM_TOOL_NAMES);
      const leftovers = custom.filter((t) => reserved.has(t.name));
      if (leftovers.length) {
        await Promise.all(leftovers.map((t) => deleteAgentTool(agentId, t.id).catch(() => undefined)));
      }
      setTools(custom.filter((t) => t.kind === "custom_webhook" && !reserved.has(t.name)));
      setSystem(nextSystem);
      lastSavedRef.current = JSON.stringify(configSnapshot(nextSystem));
      readyRef.current = true;
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't load tools"));
    }
  }, [agentId]);

  useEffect(() => {
    readyRef.current = false;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!readyRef.current || !system) return;
    const serialized = JSON.stringify(configSnapshot(system));
    if (serialized === lastSavedRef.current) {
      setSaveStatus((prev) => (prev === "saving" ? prev : "saved"));
      return;
    }
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistSystem(agentId, systemRef.current, lastSavedRef, setSaveStatus);
    }, AUTO_SAVE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [agentId, system]);

  const q = search.trim().toLowerCase();
  const filteredTools = tools.filter(
    (t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
  const filteredSystem = (system?.tools ?? []).filter(
    (t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );

  async function onToggle(name: SystemTool["name"], enabled: boolean) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setToggling(name);
    try {
      await setSystemToolEnabled(agentId, name, enabled);
      toast.success(enabled ? `Enabled ${name}` : `Disabled ${name}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this tool");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as ToolsTab)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-auto rounded-full bg-muted/70 p-1">
            <TabsTrigger
              value="system"
              className="h-auto cursor-pointer rounded-full px-3.5 py-1.5 data-active:shadow-sm"
            >
              System tools
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="h-auto cursor-pointer rounded-full px-3.5 py-1.5 data-active:shadow-sm"
            >
              Custom tools
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {tab === "system" && saveStatus ? (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {saveStatus === "saving" ? "Saving" : saveStatus === "unsaved" ? "Unsaved" : "Saved"}
              </span>
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search tools"
                className="h-9 w-44 rounded-full pl-8"
              />
            </div>
            {tab === "custom" && (
              <Button type="button" size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add tool
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="system" className="mt-0">
          {filteredSystem.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <p className="text-sm font-medium">No system tools match</p>
              <p className="mt-1 text-sm text-muted-foreground">Clear search to see built-in call tools.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span>Tool</span>
                <span>Enable</span>
              </div>
              <ul className="divide-y divide-border">
                {filteredSystem.map((t) => (
                  <SystemToolRow
                    key={t.name}
                    tool={t}
                    disabled={toggling === t.name}
                    state={system}
                    onToggle={(enabled) => void onToggle(t.name, enabled)}
                    onState={(next) => setSystem(next)}
                  />
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom" className="mt-0">
          {filteredTools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <p className="text-sm font-medium">{tools.length === 0 ? "No custom tools yet" : "No tools match"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tools.length === 0
                  ? "Add a webhook the agent can call during or after the conversation."
                  : "Clear search to see your custom tools."}
              </p>
              {tools.length === 0 && (
                <Button type="button" size="sm" className="mt-4 rounded-full" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" />
                  Add tool
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1fr_120px_80px_40px] gap-3 border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span>Tool</span>
                <span>Runs</span>
                <span>Method</span>
                <span />
              </div>
              <ul className="divide-y divide-border">
                {filteredTools.map((t) => (
                  <li key={t.id} className="grid grid-cols-[1fr_120px_80px_40px] items-center gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        <Link2 className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{t.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {t.runs_on}
                    </span>
                    <span className="text-sm text-muted-foreground">{t.method}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${t.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={async () => {
                            await deleteAgentTool(agentId, t.id);
                            void refresh();
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddToolDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={async (data) => {
          if ((RESERVED_SYSTEM_TOOL_NAMES as readonly string[]).includes(data.name)) {
            toast.error(`“${data.name}” is a system tool — enable it on the System tools tab.`);
            return;
          }
          await createAgentTool(agentId, { kind: "custom_webhook", ...data });
          setAddOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

function configSnapshot(state: SystemToolsState) {
  return {
    auto_cut_mode: state.auto_cut_mode,
    voicemail_message: state.voicemail_message,
    nudges: state.nudges,
    hangup_after_unanswered_nudges: state.hangup_after_unanswered_nudges,
    thinking_sounds_mode: state.thinking_sounds_mode,
  };
}

async function persistSystem(
  agentId: string,
  state: SystemToolsState | null,
  lastSavedRef: { current: string },
  setSaveStatus: (s: "saved" | "saving" | "unsaved" | null) => void,
) {
  if (!state) return;
  const serialized = JSON.stringify(configSnapshot(state));
  if (serialized === lastSavedRef.current) return;
  setSaveStatus("saving");
  try {
    const thinkingOn = state.tools.some((t) => t.name === "thinking_sounds" && t.enabled);
    await patchSystemToolsConfig(agentId, {
      auto_cut: { mode: state.auto_cut_mode },
      voicemail_detection: { message: state.voicemail_message },
      silence_breaker: {
        enabled: Boolean(state.tools.some((t) => t.name === "nudge" && t.enabled) && state.nudges.length > 0),
        idle_seconds: state.nudges[0]?.after_seconds || 8,
        messages: state.nudges.map((n) => ({ text: n.text, after_seconds: n.after_seconds })),
        hangup_after_unanswered: state.hangup_after_unanswered_nudges,
      },
      thinking_sounds: { mode: thinkingOn ? state.thinking_sounds_mode : "off" },
    });
    lastSavedRef.current = serialized;
    setSaveStatus("saved");
  } catch (err) {
    setSaveStatus("unsaved");
    toast.error(friendlyVoiceError(err, "Couldn't save system tool settings"));
  }
}

function SystemToolRow({
  tool,
  disabled,
  state,
  onToggle,
  onState,
}: {
  tool: SystemTool;
  disabled: boolean;
  state: SystemToolsState | null;
  onToggle: (enabled: boolean) => void;
  onState: (next: SystemToolsState) => void;
}) {
  const switchId = useId();
  const Icon = SYSTEM_ICONS[tool.name];

  function patch(partial: Partial<SystemToolsState>) {
    if (!state) return;
    onState({ ...state, ...partial });
  }

  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{tool.name}</p>
            <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
          </div>
        </div>
        <Switch
          id={switchId}
          className="cursor-pointer"
          checked={tool.enabled}
          disabled={disabled || !state}
          onCheckedChange={onToggle}
          aria-label={`Enable ${tool.name}`}
        />
      </div>
      {tool.enabled && state ? (
        <div className="mt-3 ml-12 space-y-3">
          {tool.name === "end_call" && (
            <ConfigField label="Hang up style" htmlFor={`${switchId}-mode`}>
              <Select
                value={state.auto_cut_mode}
                onValueChange={(v) => patch({ auto_cut_mode: v as AutoCutMode })}
              >
                <SelectTrigger id={`${switchId}-mode`} className="h-9 w-44 cursor-pointer rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm">Warm cut — finish the closing line</SelectItem>
                  <SelectItem value="instant">Instant cut — hang up immediately</SelectItem>
                </SelectContent>
              </Select>
            </ConfigField>
          )}
          {tool.name === "voicemail" && (
            <ConfigField label="Voicemail message" htmlFor={`${switchId}-vm`}>
              <Textarea
                id={`${switchId}-vm`}
                value={state.voicemail_message}
                onChange={(e) => patch({ voicemail_message: e.target.value })}
                rows={3}
                placeholder="Sorry we missed you. Please call us back when you can."
                className="min-h-[84px] w-full max-w-md resize-y"
              />
            </ConfigField>
          )}
          {tool.name === "nudge" && (
            <NudgeEditor
              nudges={state.nudges}
              hangup={state.hangup_after_unanswered_nudges}
              onNudges={(nudges) => {
                if (nudges.length === 0) onToggle(false);
                else patch({ nudges });
              }}
              onHangup={(hangup_after_unanswered_nudges) => patch({ hangup_after_unanswered_nudges })}
            />
          )}
          {tool.name === "thinking_sounds" && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{THINKING_SOUND_HELP[state.thinking_sounds_mode]}</p>
              <ToggleGroup
                type="single"
                value={state.thinking_sounds_mode}
                spacing={0}
                variant="outline"
                size="sm"
                onValueChange={(v) => {
                  if (v === "sounds" || v === "words") patch({ thinking_sounds_mode: v });
                }}
              >
                <ToggleGroupItem value="sounds" aria-label="Play a hesitation sound" className="cursor-pointer px-2.5">
                  Sounds
                </ToggleGroupItem>
                <ToggleGroupItem value="words" aria-label="Play an acknowledgement word" className="cursor-pointer px-2.5">
                  Words
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ConfigField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function NudgeEditor({
  nudges,
  hangup,
  onNudges,
  onHangup,
}: {
  nudges: SystemNudge[];
  hangup: boolean;
  onNudges: (next: SystemNudge[]) => void;
  onHangup: (next: boolean) => void;
}) {
  const hangupId = useId();
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <ul className="space-y-3">
          {nudges.map((n, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <GripVertical className="mb-2 size-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`nudge-text-${i}`} className="text-xs text-muted-foreground">
                  Message {i + 1}
                </Label>
                <Input
                  id={`nudge-text-${i}`}
                  value={n.text}
                  onChange={(e) => onNudges(nudges.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                  className="rounded-lg"
                />
              </div>
              <div className="flex items-center gap-1.5 pb-0.5 text-sm text-muted-foreground">
                <Label htmlFor={`nudge-after-${i}`} className="text-sm font-normal">
                  after
                </Label>
                <Input
                  id={`nudge-after-${i}`}
                  type="number"
                  min={1}
                  value={n.after_seconds}
                  onChange={(e) =>
                    onNudges(
                      nudges.map((x, idx) =>
                        idx === i ? { ...x, after_seconds: Number(e.target.value) || 0 } : x,
                      ),
                    )
                  }
                  className="h-9 w-16 rounded-lg text-center"
                />
                <span>seconds</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer text-muted-foreground hover:text-destructive"
                aria-label={`Remove message ${i + 1}`}
                onClick={() => onNudges(nudges.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 cursor-pointer rounded-full"
          onClick={() => onNudges([...nudges, { text: "Are you still there?", after_seconds: 10 }])}
        >
          <Plus className="size-4" />
          Add more
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor={hangupId} className="text-sm font-medium">
            Hang up after unanswered nudges
          </Label>
          <p className="text-xs text-muted-foreground">End the call if the caller still does not reply.</p>
        </div>
        <Switch id={hangupId} className="cursor-pointer" checked={hangup} onCheckedChange={onHangup} />
      </div>
    </div>
  );
}

function AddToolDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    description: string;
    method: string;
    url: string;
    runs_on: AgentTool["runs_on"];
    parameters: Record<string, unknown>;
    required: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("");
  const [runsOn, setRunsOn] = useState<AgentTool["runs_on"]>("during_call");
  const [params, setParams] = useState<ToolParamRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setMethod("POST");
      setUrl("");
      setRunsOn("during_call");
      setParams([]);
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !url.trim()) {
      toast.message("Name and URL are required");
      return;
    }
    const { parameters, required } = paramRowsToSchema(params);
    setSaving(true);
    try {
      await onCreate({ name, description, method, url, runs_on: runsOn, parameters, required });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add custom tool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tool-name">Name</Label>
            <Input id="tool-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="check_availability" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tool-desc">Description</Label>
            <Textarea
              id="tool-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this tool does — the LLM reads this"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-28 space-y-1.5">
              <Label htmlFor="tool-method">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="tool-method" className="w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tool-url">Webhook URL</Label>
              <Input id="tool-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <ToolParametersEditor rows={params} onChange={setParams} hint={parameterHintForMethod(method)} />
          <div className="space-y-1.5">
            <Label htmlFor="tool-runs">Runs</Label>
            <Select value={runsOn} onValueChange={(v) => setRunsOn(v as AgentTool["runs_on"])}>
              <SelectTrigger id="tool-runs" className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before_response">Before response</SelectItem>
                <SelectItem value="during_call">During call</SelectItem>
                <SelectItem value="on_end">On call end</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} loading={saving}>
            Add tool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
