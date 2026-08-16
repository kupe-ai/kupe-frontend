"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCallTransferConfig,
  updateCallTransferConfig,
} from "@/lib/api/voice/agent-builder";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { captureEvent } from "@/lib/posthog";
import type { CallTransferConfig, TransferDestination, TransferRingStrategy } from "@/types";

function newDestination(): TransferDestination {
  return {
    id: crypto.randomUUID(),
    name: "New destination",
    description: "",
    ring_strategy: "sequential",
    ring_timeout_seconds: 20,
    numbers: [{ number: "", label: "Primary" }],
    transfer_message: "One moment, I'm transferring you now.",
    no_answer_message: "Sorry, no one is available right now. Goodbye.",
  };
}

/**
 * Call transfer — lets an agent hand off a live call to a human. Each
 * destination holds an ordered list of numbers; on "sequential" ring
 * strategy the agent dials them in order, so numbers after the first are
 * the fallback recipients if the one before doesn't pick up in time.
 */
export function AgentTransferPanel({ agentId }: { agentId: string }) {
  const [config, setConfig] = useState<CallTransferConfig>({ enabled: false, destinations: [] });
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const readyRef = useRef(false);
  const lastSavedRef = useRef("");
  const configRef = useRef(config);
  configRef.current = config;

  const persist = useCallback(async (next: CallTransferConfig) => {
    const serialized = JSON.stringify(next);
    if (serialized === lastSavedRef.current) return;
    setSaveState("saving");
    try {
      const saved = await updateCallTransferConfig(agentId, next);
      lastSavedRef.current = JSON.stringify(saved);
      setConfig(saved);
      captureEvent("transfer_configured", { agent_id: agentId, enabled: saved.enabled });
      setSaveState("saved");
    } catch (err) {
      setSaveState("idle");
      toast.error(friendlyVoiceError(err, "Couldn't save transfer settings"));
    }
  }, [agentId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    readyRef.current = false;
    try {
      const loaded = await getCallTransferConfig(agentId);
      lastSavedRef.current = JSON.stringify(loaded);
      setConfig(loaded);
      readyRef.current = true;
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't load transfer settings"));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (JSON.stringify(config) === lastSavedRef.current) return;
    const t = setTimeout(() => void persist(configRef.current), 500);
    return () => clearTimeout(t);
  }, [config, persist]);

  useEffect(() => {
    return () => {
      const latest = configRef.current;
      if (readyRef.current && JSON.stringify(latest) !== lastSavedRef.current) {
        void updateCallTransferConfig(agentId, latest).catch(() => undefined);
      }
    };
  }, [agentId]);

  function patchDestination(id: string, patch: Partial<TransferDestination>) {
    setConfig((c) => ({
      ...c,
      destinations: c.destinations.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  function removeDestination(id: string) {
    setConfig((c) => ({ ...c, destinations: c.destinations.filter((d) => d.id !== id) }));
  }

  function addDestination() {
    setConfig((c) => ({ ...c, destinations: [...c.destinations, newDestination()] }));
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Call transfer</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Let the agent hand off to a human mid-call. Numbers within a destination ring in
            order — add a second number as a fallback recipient if the first doesn't answer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveState === "saving" ? (
            <span className="text-xs text-muted-foreground">Saving…</span>
          ) : saveState === "saved" ? (
            <span className="text-xs text-muted-foreground">Saved</span>
          ) : null}
          <Label htmlFor="transfer-enabled" className="text-sm text-muted-foreground">
            {config.enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="transfer-enabled"
            checked={config.enabled}
            onCheckedChange={(enabled) => setConfig((c) => ({ ...c, enabled }))}
          />
        </div>
      </div>

      {config.destinations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <Phone className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No transfer destinations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a destination — e.g. "Sales" or "Support" — with one or more numbers.
          </p>
          <Button type="button" size="sm" className="mt-4 rounded-full" onClick={addDestination}>
            <Plus className="size-4" />
            Add destination
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {config.destinations.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              onChange={(patch) => patchDestination(dest.id, patch)}
              onRemove={() => removeDestination(dest.id)}
            />
          ))}
          <Button type="button" variant="outline" className="rounded-full" onClick={addDestination}>
            <Plus className="size-4" />
            Add destination
          </Button>
        </div>
      )}
    </div>
  );
}

function DestinationCard({
  destination,
  onChange,
  onRemove,
}: {
  destination: TransferDestination;
  onChange: (patch: Partial<TransferDestination>) => void;
  onRemove: () => void;
}) {
  function updateNumber(index: number, patch: Partial<{ number: string; label: string }>) {
    const numbers = destination.numbers.map((n, i) => (i === index ? { ...n, ...patch } : n));
    onChange({ numbers });
  }

  function addNumber() {
    onChange({
      numbers: [
        ...destination.numbers,
        { number: "", label: destination.numbers.length === 0 ? "Primary" : "Fallback" },
      ],
    });
  }

  function removeNumber(index: number) {
    onChange({ numbers: destination.numbers.filter((_, i) => i !== index) });
  }

  function moveNumber(index: number, dir: -1 | 1) {
    const next = [...destination.numbers];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ numbers: next });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label>Destination name</Label>
          <Input
            value={destination.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Sales team"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mt-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove destination"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Ring strategy</Label>
          <Select
            value={destination.ring_strategy}
            onValueChange={(v) => onChange({ ring_strategy: v as TransferRingStrategy })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential — try numbers in order (fallback)</SelectItem>
              <SelectItem value="simultaneous">Simultaneous — ring all numbers at once</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ring timeout (seconds)</Label>
          <Input
            type="number"
            min={5}
            max={60}
            value={destination.ring_timeout_seconds}
            onChange={(e) => onChange({ ring_timeout_seconds: Number(e.target.value) || 20 })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Numbers{" "}
            {destination.ring_strategy === "sequential" && destination.numbers.length > 1 && (
              <span className="font-normal text-muted-foreground">— dialed top to bottom</span>
            )}
          </Label>
          <Button type="button" variant="ghost" size="sm" className="h-7 rounded-full" onClick={addNumber}>
            <Plus className="size-3.5" />
            Add number
          </Button>
        </div>
        <div className="space-y-2">
          {destination.numbers.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <Input
                value={n.number}
                onChange={(e) => updateNumber(i, { number: e.target.value })}
                placeholder="+9198XXXXXXXX"
                className="flex-1"
              />
              <Input
                value={n.label}
                onChange={(e) => updateNumber(i, { label: e.target.value })}
                placeholder={i === 0 ? "Primary" : "Fallback"}
                className="w-28 shrink-0"
              />
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => moveNumber(i, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === destination.numbers.length - 1}
                  onClick={() => moveNumber(i, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeNumber(i)}
                  aria-label="Remove number"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {destination.numbers.length === 0 && (
            <p className="text-xs text-muted-foreground">No numbers yet — add at least one.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Transfer message</Label>
          <Textarea
            value={destination.transfer_message}
            onChange={(e) => onChange({ transfer_message: e.target.value })}
            rows={2}
            placeholder="One moment, I'm transferring you now."
          />
        </div>
        <div className="space-y-1.5">
          <Label>No-answer message</Label>
          <Textarea
            value={destination.no_answer_message}
            onChange={(e) => onChange({ no_answer_message: e.target.value })}
            rows={2}
            placeholder="Sorry, no one is available right now. Goodbye."
          />
        </div>
      </div>
    </div>
  );
}
