import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pause, Play, Square, Upload } from "lucide-react";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Agent, Batch, BatchContact, BatchStats, TelephonyAccount } from "@/types";

type Props = {
  orgId: string;
  projectId: string;
  batchId: string | null;
  onBack: () => void;
  onCreated: (batchId: string) => void;
};

const CONTACT_PAGE = 20;

export function BatchDetailPage({ orgId, projectId, batchId, onBack, onCreated }: Props) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [contacts, setContacts] = useState<BatchContact[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactOffset, setContactOffset] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<TelephonyAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(batchId));

  // Create form
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [maxRetries, setMaxRetries] = useState(0);
  const [retryDelay, setRetryDelay] = useState(60);
  const [jsonContacts, setJsonContacts] = useState(
    '[{"phone_number": "+15551234567", "variables": {"first_name": "Sam"}}]',
  );

  const refresh = useCallback(async (id: string) => {
    const [b, s, c] = await Promise.all([
      api.getBatch(id),
      api.getBatchStats(id),
      api.listBatchContacts(id, { limit: CONTACT_PAGE, offset: contactOffset }),
    ]);
    setBatch(b);
    setStats(s);
    setContacts(c.items);
    setContactTotal(c.total);
  }, [contactOffset]);

  useEffect(() => {
    api.listAgents(orgId, projectId, { limit: 100 }).then((p) => setAgents(p.items)).catch(() => undefined);
    api.listTelephonyAccounts(orgId).then(setAccounts).catch(() => undefined);
  }, [orgId, projectId]);

  useEffect(() => {
    if (!batchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh(batchId)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load batch"))
      .finally(() => setLoading(false));
  }, [batchId, refresh]);

  async function create() {
    if (!name.trim() || !agentId || !accountId) {
      setError("Name, agent, and telephony account are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createBatch({
        org_id: orgId,
        project_id: projectId,
        agent_id: agentId,
        telephony_account_id: accountId,
        name: name.trim(),
        max_concurrent_calls: maxConcurrent,
        retry_policy: {
          max_retries: maxRetries,
          retry_delay_seconds: retryDelay,
          retryable_outcomes: ["no_answer", "busy"],
        },
      });
      onCreated(created.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadCsv(file: File | null) {
    if (!batch || !file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadBatchContactsCsv(batch.id, file);
      await refresh(batch.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addJsonContacts() {
    if (!batch) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(jsonContacts) as { phone_number: string; variables?: Record<string, unknown> }[];
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of contacts");
      await api.addBatchContactsBulk(batch.id, parsed);
      await refresh(batch.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "start" | "pause" | "resume" | "cancel") {
    if (!batch) return;
    setBusy(true);
    setError(null);
    try {
      const fn = {
        start: api.startBatch,
        pause: api.pauseBatch,
        resume: api.resumeBatch,
        cancel: api.cancelBatch,
      }[action];
      const updated = await fn(batch.id);
      setBatch(updated);
      const s = await api.getBatchStats(batch.id);
      setStats(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading batch…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {batch && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{batch.name}</h2>
            <Badge variant="outline">{batch.status}</Badge>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!batchId && (
        <Card>
          <CardHeader>
            <CardTitle>New batch</CardTitle>
            <CardDescription>Choose an agent and telephony account, then add contacts on the next screen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="batch-name">Name</Label>
              <Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="April collections" />
            </div>
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telephony account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={accounts.length ? "Select account" : "Add one in Settings"} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label || a.provider} · {a.from_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-conc">Max concurrent calls</Label>
              <Input
                id="max-conc"
                type="number"
                min={1}
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-retries">Max retries</Label>
              <Input
                id="max-retries"
                type="number"
                min={0}
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retry-delay">Retry delay (seconds)</Label>
              <Input
                id="retry-delay"
                type="number"
                min={0}
                value={retryDelay}
                onChange={(e) => setRetryDelay(Number(e.target.value) || 0)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button className="cursor-pointer" disabled={busy} onClick={() => void create()}>
                {busy ? "Creating…" : "Create batch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {batch && (
        <>
          <div className="flex flex-wrap gap-2">
            {batch.status === "draft" && (
              <Button className="cursor-pointer" disabled={busy} onClick={() => void runAction("start")}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            )}
            {batch.status === "running" && (
              <Button variant="outline" className="cursor-pointer" disabled={busy} onClick={() => void runAction("pause")}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            {batch.status === "paused" && (
              <Button className="cursor-pointer" disabled={busy} onClick={() => void runAction("resume")}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            {batch.status !== "completed" && batch.status !== "cancelled" && (
              <Button variant="destructive" className="cursor-pointer" disabled={busy} onClick={() => void runAction("cancel")}>
                <Square className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>

          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Contacts</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(stats.contacts_by_status).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-4">
                        <span>{k}</span>
                        <span className="font-mono">{v}</span>
                      </li>
                    ))}
                    {Object.keys(stats.contacts_by_status).length === 0 && (
                      <li className="text-muted-foreground">No contacts yet</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Attempts</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(stats.attempts_by_status).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-4">
                        <span>{k}</span>
                        <span className="font-mono">{v}</span>
                      </li>
                    ))}
                    {Object.keys(stats.attempts_by_status).length === 0 && (
                      <li className="text-muted-foreground">No attempts yet</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {batch.status === "draft" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV</CardTitle>
                  <CardDescription>
                    Requires a <code className="text-xs">phone_number</code> column. Other columns become template variables.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="csv" className="cursor-pointer">
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:bg-accent/40">
                      <Upload className="h-4 w-4" />
                      Choose CSV file
                    </div>
                    <Input
                      id="csv"
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(e) => void uploadCsv(e.target.files?.[0] ?? null)}
                    />
                  </Label>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Add JSON contacts</CardTitle>
                  <CardDescription>Array of objects with phone_number and optional variables.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={jsonContacts}
                    onChange={(e) => setJsonContacts(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <Button className="cursor-pointer" disabled={busy} onClick={() => void addJsonContacts()}>
                    Add contacts
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                {batch.max_concurrent_calls} max concurrent · retries {batch.retry_policy.max_retries}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-border rounded-md border border-border">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-mono">{c.phone_number}</span>
                    <Badge variant="outline">{c.status}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">attempts {c.attempt_count}</span>
                  </li>
                ))}
                {contacts.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts</li>
                )}
              </ul>
              <PaginationControls
                total={contactTotal}
                limit={CONTACT_PAGE}
                offset={contactOffset}
                onPageChange={setContactOffset}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
