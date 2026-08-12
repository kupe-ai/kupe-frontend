import { useEffect, useState } from "react";
import { ArrowRight, GitBranch, Plus, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Flow } from "@/types";

type Props = {
  orgId: string;
  projectId: string;
  onCreate: () => void;
  onOpen: (flowId: string) => void;
};

export function FlowsPanel({ orgId, projectId, onCreate, onOpen }: Props) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listFlows(orgId, projectId, { limit: 100 })
      .then((page) => {
        setFlows(page.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load flows"))
      .finally(() => setLoading(false));
  }, [orgId, projectId]);

  const filtered = flows.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search flows"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search flows"
          />
        </div>
        <Button onClick={onCreate} className="cursor-pointer sm:shrink-0">
          <Plus className="h-4 w-4" />
          New flow
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading flows…</p>}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border bg-card p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">No flows yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Build a conversation graph with editable nodes and transition paths, then attach it to an agent.
            </p>
          </div>
          <Button onClick={onCreate} className="cursor-pointer">
            <Plus className="h-4 w-4" />
            Create your first flow
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {filtered.map((flow) => {
          const nodeCount = Object.keys(flow.definition?.nodes ?? {}).length;
          return (
            <li key={flow.id}>
              <button
                type="button"
                onClick={() => onOpen(flow.id)}
                className="group flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors duration-150 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{flow.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {nodeCount} node{nodeCount === 1 ? "" : "s"} · updated{" "}
                    {new Date(flow.updated_at).toLocaleString()}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
