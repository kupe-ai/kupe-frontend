import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CallTransferConfig, TransferDestination, TransferRingStrategy } from "@/types";

type Props = {
  config: CallTransferConfig;
  onChange: (next: CallTransferConfig) => void;
};

function emptyDestination(): TransferDestination {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    ring_strategy: "sequential",
    ring_timeout_seconds: 20,
    numbers: [{ number: "", label: "" }],
    transfer_message: "One moment, I'm transferring you now.",
  };
}

export function CallTransferCard({ config, onChange }: Props) {
  function updateDest(i: number, patch: Partial<TransferDestination>) {
    const destinations = config.destinations.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    onChange({ ...config, destinations });
  }
  function addDest() {
    onChange({ ...config, destinations: [...config.destinations, emptyDestination()] });
  }
  function removeDest(i: number) {
    onChange({ ...config, destinations: config.destinations.filter((_, idx) => idx !== i) });
  }
  function updateNumber(i: number, j: number, patch: Partial<{ number: string; label: string }>) {
    const numbers = config.destinations[i].numbers.map((n, idx) => (idx === j ? { ...n, ...patch } : n));
    updateDest(i, { numbers });
  }
  function addNumber(i: number) {
    updateDest(i, { numbers: [...config.destinations[i].numbers, { number: "", label: "" }] });
  }
  function removeNumber(i: number, j: number) {
    updateDest(i, { numbers: config.destinations[i].numbers.filter((_, idx) => idx !== j) });
  }

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <h3 className="text-sm font-medium">Call transfer</h3>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
        <Checkbox
          checked={config.enabled}
          onCheckedChange={(v) => onChange({ ...config, enabled: v === true })}
        />
        <span>
          <span className="font-medium">Allow agent to transfer callers</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Registers a <code className="text-xs">transfer_call</code> tool the agent can use to hand
            telephony callers off to a named destination after finishing its turn.
          </span>
        </span>
      </label>

      {config.enabled && (
        <div className="space-y-4">
          {config.destinations.map((dest, i) => (
            <div key={dest.id} className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-start gap-3">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Destination name</Label>
                    <Input
                      placeholder="Billing"
                      value={dest.name}
                      onChange={(e) => updateDest(i, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>When to transfer</Label>
                    <Input
                      placeholder="Caller asks for billing, or wants a human"
                      value={dest.description}
                      onChange={(e) => updateDest(i, { description: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-6 cursor-pointer"
                  onClick={() => removeDest(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ring strategy</Label>
                  <Select
                    value={dest.ring_strategy}
                    onValueChange={(v) => updateDest(i, { ring_strategy: v as TransferRingStrategy })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simultaneous">Ring all at once</SelectItem>
                      <SelectItem value="sequential">Ring one at a time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ring timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={5}
                    step={1}
                    value={dest.ring_timeout_seconds}
                    onChange={(e) => updateDest(i, { ring_timeout_seconds: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Numbers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => addNumber(i)}
                  >
                    <Plus className="h-4 w-4" />
                    Add number
                  </Button>
                </div>
                {dest.numbers.map((num, j) => (
                  <div key={j} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      placeholder="+14155552671"
                      value={num.number}
                      onChange={(e) => updateNumber(i, j, { number: e.target.value })}
                    />
                    <Input
                      placeholder="Label (optional)"
                      value={num.label}
                      onChange={(e) => updateNumber(i, j, { label: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => removeNumber(i, j)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Transfer message</Label>
                <Textarea
                  rows={2}
                  value={dest.transfer_message}
                  onChange={(e) => updateDest(i, { transfer_message: e.target.value })}
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="cursor-pointer" onClick={addDest}>
            <Plus className="h-4 w-4" />
            Add destination
          </Button>
        </div>
      )}
    </div>
  );
}
