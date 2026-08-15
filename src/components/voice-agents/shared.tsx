"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Search,
} from "lucide-react";
import { PetSprite } from "@/components/pets/pet-sprite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_FILTERS,
  type RecentVoiceAgent,
  type TemplateCategory,
  type VoiceAgentTemplate,
} from "@/lib/voice-agents-data";
import { TemplateAgentDialog } from "@/components/voice-agents/template-agent-dialog";
import { listVoiceAgentTemplates } from "@/lib/api/voice/agents";

export function VoicePageHeader({
  title,
  actions,
  className,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      {actions}
    </div>
  );
}

export function VoicePagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = [3, 5, 10, 20],
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (n: number) => void;
  perPageOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Show</span>
        <Select
          value={String(perPage)}
          onValueChange={(v) => onPerPageChange(Number(v))}
        >
          <SelectTrigger size="sm" className="h-7 w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {perPageOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>Per page</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {from}-{to} of {total}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function RecentAgentsTable({
  agents,
  searchPlaceholder = "Search...",
  defaultPerPage = 3,
}: {
  agents: RecentVoiceAgent[];
  searchPlaceholder?: string;
  defaultPerPage?: number;
}) {
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((a) => {
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sortDesc
          ? b.lastEditedAt - a.lastEditedAt
          : a.lastEditedAt - b.lastEditedAt,
      );
  }, [agents, search, sortDesc]);

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

  const pageStart = (page - 1) * perPage;
  const pageItems = filtered.slice(pageStart, pageStart + perPage);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 rounded-full pl-8"
            aria-label="Search agents"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span>Agent</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => setSortDesc((v) => !v)}
          >
            Last edited
            <ArrowDown
              className={cn(
                "size-3.5 transition-transform",
                !sortDesc && "rotate-180",
              )}
            />
          </button>
        </div>
        {pageItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No agents match your search.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pageItems.map((agent) => (
              <li key={agent.id}>
                <Link
                  to={`/voice-agents/agents/${agent.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                      <PetSprite seed={agent.seed} size={22} frame="stand" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {agent.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {agent.lastEdited}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-3">
          <VoicePagination
            page={page}
            perPage={perPage}
            total={filtered.length}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </div>
    </div>
  );
}

const INITIAL_TEMPLATE_COUNT = 6;

export function AgentTemplatesSection({
  onSelect,
}: {
  onSelect?: (tpl: VoiceAgentTemplate) => void;
}) {
  const [filter, setFilter] = useState<TemplateCategory>("all");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<VoiceAgentTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<VoiceAgentTemplate[]>([]);

  useEffect(() => {
    listVoiceAgentTemplates()
      .then((rows) =>
        setTemplates(
          rows.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: (t.category === "all" ? "collections" : t.category) as VoiceAgentTemplate["category"],
            seed: t.seed,
            createdBy: "Kupe",
            callsCompleted: "0",
            about: t.about,
            scenario: t.scenario,
            languages: t.languages,
            tools: t.tools,
            variables: t.variables,
          })),
        ),
      )
      .catch(() => setTemplates([]));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    return templates.filter((t) => t.category === filter);
  }, [templates, filter]);

  const visible = showAll
    ? filtered
    : filtered.slice(0, INITIAL_TEMPLATE_COUNT);

  function openTemplate(tpl: VoiceAgentTemplate) {
    onSelect?.(tpl);
    setSelected(tpl);
    setOpen(true);
  }

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Agent templates</h2>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setShowAll(false);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => openTemplate(tpl)}
            className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <PetSprite seed={tpl.seed} size={26} frame="stand" />
            </div>
            <h3 className="mt-3 text-sm font-semibold tracking-tight">
              {tpl.name}
            </h3>
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {tpl.description}
            </p>
          </button>
        ))}
      </div>

      {filtered.length > INITIAL_TEMPLATE_COUNT ? (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? (
              <>
                View less
                <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                View more
                <ChevronDown className="size-4" />
              </>
            )}
          </Button>
        </div>
      ) : null}

      <TemplateAgentDialog
        template={selected}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
}
