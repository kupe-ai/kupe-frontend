import { useEffect, useState } from "react";
import { ArrowRight, ListTodo, Plus, Search } from "lucide-react";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Batch, BatchStatus } from "@/types";

type Props = {
  orgId: string;
  projectId: string;
  onCreate: () => void;
  onOpen: (batchId: string) => void;
};

const PAGE_SIZE = 20;

function statusVariant(status: BatchStatus): "default" | "secondary" | "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "running":
      return "success";
    case "paused":
      return "warning";
    case "completed":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function BatchesPanel({ orgId, projectId, onCreate, onOpen }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listBatches(orgId, projectId, { limit: PAGE_SIZE, offset })
      .then((page) => {
        setBatches(page.items);
        setTotal(page.total);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load batches"))
      .finally(() => setLoading(false));
  }, [orgId, projectId, offset]);

  const filtered = batches.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search batches"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search batches"
          />
        </div>
        <Button onClick={onCreate} className="cursor-pointer sm:shrink-0">
          <Plus className="h-4 w-4" />
          New batch
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading batches…</p>}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border bg-card p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListTodo className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">No batches yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create a batch, upload contacts, and dial them through Twilio, Plivo, or Exotel using a saved agent.
            </p>
          </div>
          <Button onClick={onCreate} className="cursor-pointer">
            <Plus className="h-4 w-4" />
            Create your first batch
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {filtered.map((batch) => (
          <li key={batch.id}>
            <button
              type="button"
              onClick={() => onOpen(batch.id)}
              className="group flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors duration-150 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <ListTodo className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{batch.name}</span>
                  <Badge variant={statusVariant(batch.status)}>{batch.status}</Badge>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  max {batch.max_concurrent_calls} concurrent · created {new Date(batch.created_at).toLocaleString()}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>

      <PaginationControls total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
    </div>
  );
}
