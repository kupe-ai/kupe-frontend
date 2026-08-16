"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import {
  createAgentTool,
  deleteAgentTool,
  listAgentTools,
  listSystemTools,
  setSystemToolEnabled,
  type AgentTool,
  type SystemTool,
} from "@/lib/api/voice/agent-builder";

type ToolsTab = "custom" | "system";

export function AgentToolsPanel({ agentId }: { agentId: string }) {
  const [tab, setTab] = useState<ToolsTab>("custom");
  const [search, setSearch] = useState("");
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [systemTools, setSystemTools] = useState<SystemTool[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [custom, system] = await Promise.all([listAgentTools(agentId), listSystemTools(agentId)]);
    setTools(custom.filter((t) => t.kind === "custom_webhook"));
    setSystemTools(system);
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filteredTools = tools.filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  const filteredSystem = systemTools.filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted/70 p-1">
          {(
            [
              ["custom", "Custom tools"],
              ["system", "System tools"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "pressable rounded-full px-3.5 py-1.5 text-sm",
                tab === id
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
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

      {tab === "system" ? (
        filteredSystem.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm font-medium">No system tools available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Built-in org tools (CRM, tasks, invoices…) will show here once configured.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Tool</span>
              <span>Enable</span>
            </div>
            <ul className="divide-y divide-border">
              {filteredSystem.map((t) => (
                <li key={t.name} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant={t.enabled ? "secondary" : "outline"}
                    size="sm"
                    className="rounded-full"
                    disabled={toggling === t.name}
                    onClick={async () => {
                      setToggling(t.name);
                      try {
                        await setSystemToolEnabled(agentId, t.name, !t.enabled);
                        toast.success(t.enabled ? `Disabled ${t.name}` : `Enabled ${t.name}`);
                        void refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't update this tool");
                      } finally {
                        setToggling(null);
                      }
                    }}
                  >
                    {toggling === t.name ? "Working…" : t.enabled ? "Disable" : "Enable"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )
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
                    ⛓
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </div>
                <span className="inline-flex w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{t.runs_on}</span>
                <span className="text-sm text-muted-foreground">{t.method}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="More">
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

      <AddToolDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={async (data) => {
          await createAgentTool(agentId, { kind: "custom_webhook", ...data });
          setAddOpen(false);
          void refresh();
        }}
      />
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
  onCreate: (data: { name: string; description: string; method: string; url: string; runs_on: AgentTool["runs_on"] }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("");
  const [runsOn, setRunsOn] = useState<AgentTool["runs_on"]>("during_call");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setMethod("POST");
      setUrl("");
      setRunsOn("during_call");
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !url.trim()) {
      toast.message("Name and URL are required");
      return;
    }
    setSaving(true);
    try {
      await onCreate({ name, description, method, url, runs_on: runsOn });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add custom tool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="check_availability" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this tool does" />
          </div>
          <div className="flex gap-2">
            <div className="w-28 space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full">
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
              <Label>Webhook URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Runs</Label>
            <Select value={runsOn} onValueChange={(v) => setRunsOn(v as AgentTool["runs_on"])}>
              <SelectTrigger className="w-full">
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
