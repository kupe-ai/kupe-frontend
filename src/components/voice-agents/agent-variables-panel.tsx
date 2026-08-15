"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createCallGoal,
  createInputVariable,
  createOutputVariable,
  deleteCallGoal,
  deleteInputVariable,
  deleteOutputVariable,
  listCallGoals,
  listInputVariables,
  listOutputVariables,
  updateInputVariable,
  updateOutputVariable,
  type CallGoal,
  type InputVariable,
  type OutputVariable,
} from "@/lib/api/voice/agent-builder";

type VarsTab = "input" | "output";

const GOAL_OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "in", label: "in" },
  { value: "not_in", label: "not in" },
  { value: "gt", label: ">" },
] as const;

export function AgentVariablesPanel({ agentId }: { agentId: string }) {
  const [tab, setTab] = useState<VarsTab>("input");
  const [search, setSearch] = useState("");
  const [infoOpen, setInfoOpen] = useState(true);
  const [inputs, setInputs] = useState<InputVariable[]>([]);
  const [outputs, setOutputs] = useState<OutputVariable[]>([]);
  const [goals, setGoals] = useState<CallGoal[]>([]);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalField, setGoalField] = useState("");
  const [goalOp, setGoalOp] = useState<string>("eq");
  const [goalValue, setGoalValue] = useState("");
  const [editingVar, setEditingVar] = useState<InputVariable | OutputVariable | "new-input" | "new-output" | null>(null);

  const refresh = useCallback(async () => {
    const [i, o, g] = await Promise.all([listInputVariables(agentId), listOutputVariables(agentId), listCallGoals(agentId)]);
    setInputs(i);
    setOutputs(o);
    setGoals(g);
    if (g[0]) {
      setGoalField(g[0].output_variable_id);
      setGoalOp(g[0].field_operator);
      setGoalValue(g[0].value);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filteredInputs = inputs.filter((v) => !q || v.name.toLowerCase().includes(q));
  const filteredOutputs = outputs.filter((v) => !q || v.name.toLowerCase().includes(q));
  const activeGoal = goals[0] ?? null;

  async function saveGoal() {
    if (!goalField || !goalValue) {
      toast.message("Pick a variable and value for the call goal");
      return;
    }
    try {
      if (activeGoal) await deleteCallGoal(agentId, activeGoal.id);
      await createCallGoal(agentId, { output_variable_id: goalField, field_operator: goalOp as CallGoal["field_operator"], value: goalValue });
      setGoalEditing(false);
      void refresh();
      toast.success("Call goal saved");
    } catch {
      toast.error("Couldn't save call goal");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-6">
      {infoOpen && (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Input and output variables</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Input variables personalise the conversation, like greeting the
              caller by name. Output variables capture the summary and outcome
              for you to review later.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setInfoOpen(false)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted/70 p-1">
          {(
            [
              ["input", "Input variables"],
              ["output", "Output variables"],
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
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={() => setEditingVar(tab === "input" ? "new-input" : "new-output")}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      {tab === "output" && (
        <div className="rounded-xl border border-border">
          {!goalEditing ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 text-sm text-muted-foreground" aria-hidden>
                  ⌁
                </span>
                <div>
                  <p className="text-sm text-foreground">
                    {activeGoal ? (
                      <>
                        Successful when{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {outputs.find((o) => o.id === activeGoal.output_variable_id)?.name ?? activeGoal.output_variable_id}
                        </code>{" "}
                        {GOAL_OPS.find((o) => o.value === activeGoal.field_operator)?.label}{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{activeGoal.value}</code>
                      </>
                    ) : (
                      "When does a call count as a win? Score every call on one output variable."
                    )}
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" className="shrink-0 rounded-full" onClick={() => setGoalEditing(true)} disabled={outputs.length === 0}>
                {activeGoal ? "Edit call goal" : "Set call goal"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs">✓</span>
                  Successful when
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setGoalEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" className="rounded-full" onClick={() => void saveGoal()}>
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={goalField} onValueChange={setGoalField}>
                  <SelectTrigger className="h-9 min-w-[180px] rounded-full">
                    <SelectValue placeholder="Select variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {outputs.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={goalOp} onValueChange={setGoalOp}>
                  <SelectTrigger className="h-9 w-[100px] rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_OPS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={goalValue} onChange={(e) => setGoalValue(e.target.value)} placeholder="Enter value" className="h-9 max-w-xs rounded-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "input" ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_1fr_40px] gap-3 border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Variable name</span>
            <span>Default value</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {filteredInputs.map((v) => (
              <li key={v.id} className="grid grid-cols-[1fr_1fr_40px] items-center gap-3 px-4 py-3">
                <code className="truncate text-sm">{v.name}</code>
                <span className="truncate text-sm text-muted-foreground">{v.default_value}</span>
                <RowMenu
                  onEdit={() => setEditingVar(v)}
                  onDelete={async () => {
                    await deleteInputVariable(agentId, v.id);
                    void refresh();
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_40px] gap-3 border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Variable name</span>
            <span>Data type</span>
            <span>Extraction prompt</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {filteredOutputs.map((v) => (
              <li key={v.id} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_40px] items-center gap-3 px-4 py-3">
                <code className="truncate text-sm">{v.name}</code>
                <span className="truncate text-sm text-muted-foreground">{v.data_type}</span>
                <span className="truncate text-sm text-muted-foreground">{v.extraction_prompt}</span>
                <RowMenu
                  onEdit={() => setEditingVar(v)}
                  onDelete={async () => {
                    await deleteOutputVariable(agentId, v.id);
                    void refresh();
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <VariableEditDialog
        agentId={agentId}
        target={editingVar}
        onClose={() => setEditingVar(null)}
        onSaved={() => {
          setEditingVar(null);
          void refresh();
        }}
      />
    </div>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="More">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onDelete()}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VariableEditDialog({
  agentId,
  target,
  onClose,
  onSaved,
}: {
  agentId: string;
  target: InputVariable | OutputVariable | "new-input" | "new-output" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isOutput = target === "new-output" || (typeof target === "object" && target !== null && "data_type" in target);
  const isNew = target === "new-input" || target === "new-output";
  const existing = typeof target === "object" ? target : null;

  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [dataType, setDataType] = useState<OutputVariable["data_type"]>("string");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (existing) {
      setName(existing.name);
      if ("default_value" in existing) setDefaultValue(existing.default_value);
      if ("data_type" in existing) {
        setDataType(existing.data_type);
        setExtractionPrompt(existing.extraction_prompt);
      }
    } else {
      setName("");
      setDefaultValue("");
      setDataType("string");
      setExtractionPrompt("");
    }
  }, [target, existing]);

  async function save() {
    if (!name.trim()) {
      toast.message("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (isOutput) {
        if (isNew) await createOutputVariable(agentId, { name, data_type: dataType, extraction_prompt: extractionPrompt });
        else if (existing) await updateOutputVariable(agentId, existing.id, { name, data_type: dataType, extraction_prompt: extractionPrompt });
      } else {
        if (isNew) await createInputVariable(agentId, { name, default_value: defaultValue });
        else if (existing) await updateInputVariable(agentId, existing.id, { name, default_value: defaultValue });
      }
      onSaved();
    } catch {
      toast.error("Couldn't save variable");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add variable" : "Edit variable"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="variable_name" />
          {isOutput ? (
            <>
              <Select value={dataType} onValueChange={(v) => setDataType(v as OutputVariable["data_type"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="enum">Enum</SelectItem>
                </SelectContent>
              </Select>
              <textarea
                value={extractionPrompt}
                onChange={(e) => setExtractionPrompt(e.target.value)}
                placeholder="What should be extracted from the call?"
                rows={3}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              />
            </>
          ) : (
            <Input value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} placeholder="Default value" />
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
