import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PostCallAnalysis } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Props = {
  orgId: string;
  agentId: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/** Lets the caller pick which post-call analyses run when the session ends.
 * When an agent is selected, its enabled attachments are pre-checked; the
 * user can still add/remove any org analysis for this call only.
 */
export default function AnalysisPicker({ orgId, agentId, selectedIds, onChange }: Props) {
  const [analyses, setAnalyses] = useState<PostCallAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAnalyses(orgId, { limit: 100 })
      .then((page) => setAnalyses(page.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analyses"));
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agentId) {
        onChange([]);
        return;
      }
      try {
        const page = await api.listAgentAnalyses(agentId, { limit: 100 });
        if (cancelled) return;
        onChange(page.items.filter((a) => a.enabled).map((a) => a.id));
      } catch {
        if (!cancelled) onChange([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-seed when the agent changes; don't loop on onChange identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function toggle(id: string, checked: boolean) {
    if (checked) onChange([...selectedIds, id]);
    else onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Post-call analyses</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Selected analyses run automatically when this call ends.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {analyses.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No analyses yet — create one under Analyses, then select it here.
        </p>
      )}
      <div className="space-y-2">
        {analyses.map((a) => {
          const checked = selectedIds.includes(a.id);
          return (
            <label key={a.id} className="flex items-start gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => toggle(a.id, v === true)} />
              <span>
                <span className="font-medium">{a.name}</span>
                {a.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{a.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
