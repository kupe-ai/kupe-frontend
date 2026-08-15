"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, Loader2, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PetSprite } from "@/components/pets/pet-sprite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  createTestCase,
  deleteTestCase,
  getTestRun,
  listTestCases,
  runAllTests,
  runTestCase,
  updateTestCase,
  type AgentTestCase,
  type AgentTestRun,
} from "@/lib/api/voice/agent-builder";

type TestsTab = "tests" | "runs";

export function AgentTestsPanel({ agentId, seed }: { agentId: string; seed: string }) {
  const [tab, setTab] = useState<TestsTab>("tests");
  const [search, setSearch] = useState("");
  const [tests, setTests] = useState<AgentTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [runOpen, setRunOpen] = useState(false);
  const [runMultiplier, setRunMultiplier] = useState(1);
  const [runName, setRunName] = useState("");
  const [pendingRunTestId, setPendingRunTestId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<AgentTestRun | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTests(await listTestCases(agentId));
    } catch {
      toast.error("Couldn't load tests");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const editing = tests.find((t) => t.id === editId) ?? null;
  const q = search.trim().toLowerCase();
  const filtered = tests.filter(
    (t) => !q || t.name.toLowerCase().includes(q) || t.scenario.toLowerCase().includes(q),
  );

  async function addTest() {
    try {
      const created = await createTestCase(agentId, {
        name: "New test",
        scenario: "Describe the caller scenario…",
        behaviors: ["Agent greets the caller."],
      });
      setTests((list) => [...list, created]);
      setEditId(created.id);
    } catch {
      toast.error("Couldn't create test");
    }
  }

  function pollRun(runId: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const run = await getTestRun(agentId, runId);
      setActiveRun(run);
      if (run.status === "completed" || run.status === "failed") {
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    }, 2000);
  }

  async function startRun() {
    setRunOpen(false);
    setTab("runs");
    try {
      const run = pendingRunTestId
        ? await runTestCase(agentId, pendingRunTestId, runMultiplier, runName || undefined)
        : await runAllTests(agentId, runMultiplier, runName || undefined);
      setActiveRun(run);
      pollRun(run.id);
      toast.success("Tests started");
    } catch {
      toast.error("Couldn't start test run");
    } finally {
      setPendingRunTestId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <CheckSquare className="size-7" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Know if your agent works</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Write a test case, then run it — a text-only simulation against this agent&apos;s
            real instructions and tools.
          </p>
        </div>
        <Button type="button" className="rounded-full" onClick={() => void addTest()}>
          <Plus className="size-4" />
          Add test
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted/70 p-1">
          {(
            [
              ["tests", "Tests"],
              ["runs", "Runs"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition-colors",
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
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void addTest()}>
            <Plus className="size-4" />
            Add test
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setPendingRunTestId(null);
              setRunOpen(true);
            }}
          >
            Run all
          </Button>
        </div>
      </div>

      {tab === "runs" ? (
        activeRun ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5 text-sm">
              <span className="font-medium">{activeRun.run_name || "Run"}</span>
              <span className="capitalize text-muted-foreground">{activeRun.status}</span>
            </div>
            {activeRun.status === "running" || activeRun.status === "queued" ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Running…
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(activeRun.results ?? []).map((r, i) => (
                  <li key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {tests.find((t) => t.id === r.test_case_id)?.name ?? "Test"}
                      </span>
                      <span className={cn("text-xs font-medium", r.passed ? "text-emerald-600" : "text-destructive")}>
                        {r.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {r.behavior_results.map((b, j) => (
                        <li key={j} className="text-xs text-muted-foreground">
                          {b.met ? "✓" : "✗"} {b.behavior}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
            No runs yet. Start one with Run all.
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_100px_120px] gap-3 border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Test</span>
            <span>Status</span>
            <span className="text-right">Run</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-[1fr_100px_120px] items-center gap-3 px-4 py-3"
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => setEditId(t.id)}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <PetSprite seed={`${seed}-${t.id}`} size={18} frame="stand" />
                  </div>
                  <span className="truncate text-sm font-medium">{t.name}</span>
                </button>
                <span className="text-sm text-muted-foreground">—</span>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full"
                    onClick={() => {
                      setPendingRunTestId(t.id);
                      setRunOpen(true);
                    }}
                  >
                    Run
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditId(t.id)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await deleteTestCase(agentId, t.id);
                          setTests((list) => list.filter((x) => x.id !== t.id));
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogTitle className="text-base font-semibold">Run tests</DialogTitle>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setRunOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="text-lg font-semibold">
                {pendingRunTestId ? 1 : filtered.length} test{pendingRunTestId || filtered.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-muted-foreground">
                Each test runs as a text simulation against this agent's real instructions.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Runs per test case</p>
              <div className="inline-flex rounded-full bg-muted p-1">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRunMultiplier(n)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm",
                      runMultiplier === n
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Name this run — optional
              </label>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g. After prompt v2"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setRunOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void startRun()}>
              Run tests
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          {editing && (
            <EditTestDialog
              agentId={agentId}
              test={editing}
              onClose={() => setEditId(null)}
              onSaved={(updated) => {
                setTests((list) => list.map((t) => (t.id === updated.id ? updated : t)));
                setEditId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditTestDialog({
  agentId,
  test,
  onClose,
  onSaved,
}: {
  agentId: string;
  test: AgentTestCase;
  onClose: () => void;
  onSaved: (t: AgentTestCase) => void;
}) {
  const [name, setName] = useState(test.name);
  const [scenario, setScenario] = useState(test.scenario);
  const [behaviors, setBehaviors] = useState(test.behaviors);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await updateTestCase(agentId, test.id, { name, scenario, behaviors });
      onSaved(updated);
      toast.success("Test saved");
    } catch {
      toast.error("Couldn't save test");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <DialogTitle className="text-base font-semibold">Edit test</DialogTitle>
        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">User scenario</label>
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Expected behaviors</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full"
              onClick={() => setBehaviors((b) => [...b, "New expected behavior"])}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {behaviors.map((b, i) => (
              <li key={i} className="flex gap-2 rounded-xl bg-muted/40 px-3 py-2">
                <textarea
                  value={b}
                  rows={2}
                  onChange={(e) => setBehaviors((list) => list.map((x, idx) => (idx === i ? e.target.value : x)))}
                  className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  className="shrink-0 self-start p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Remove behavior"
                  onClick={() => setBehaviors((list) => list.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" className="rounded-full" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}
