"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Copy,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { VoicePagination } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getKnowledgeBase,
  deleteKnowledgeFile,
  listKnowledgeFiles,
  searchKnowledgeBase,
  uploadKnowledgeFile,
} from "@/lib/api/voice/knowledge-bases";
import type { VoiceKnowledgeBase, VoiceKnowledgeFile } from "@/lib/api/voice/types";
import { cn } from "@/lib/utils";
import { VoiceTableShimmer } from "@/components/ui/shimmer";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type RetrievalHit = { content: string; similarity: number };

export default function VoiceAgentsKnowledgeDetailPage() {
  const { id = "" } = useParams();
  const [kb, setKb] = useState<VoiceKnowledgeBase | null>(null);
  const [files, setFiles] = useState<VoiceKnowledgeFile[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [question, setQuestion] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RetrievalHit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!id) {
      setKb(null);
      setFiles([]);
      setTotalFiles(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [kbRes, filesRes] = await Promise.all([
        getKnowledgeBase(id),
        listKnowledgeFiles(id, { page, page_size: perPage }),
      ]);
      setKb(kbRes);
      setFiles(filesRes.items);
      setTotalFiles(filesRes.total);
      document.title = `${kbRes.name} · Knowledge base · Kupe`;
    } catch {
      setKb(null);
    } finally {
      setLoading(false);
    }
  }, [id, page, perPage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalSize = files.reduce((s, f) => s + f.size_bytes, 0);

  async function handleUpload(fileList: FileList | null) {
    if (!id || !fileList?.length) return;
    try {
      await Promise.all(Array.from(fileList).map((f) => uploadKnowledgeFile(id, f)));
      toast.message("Uploading files");
      void refresh();
    } catch {
      toast.error("Upload failed");
    }
  }

  async function runSearch() {
    if (!question.trim()) return;
    setSearching(true);
    try {
      const res = await searchKnowledgeBase(id, question.trim());
      setResults(res);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        <Link
          to="/knowledge-base"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Knowledge base
        </Link>
        <div className="mt-8">
          <VoiceTableShimmer rows={5} />
        </div>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="h-full overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        <Link
          to="/knowledge-base"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Knowledge base
        </Link>
        <p className="mt-8 text-sm text-muted-foreground">
          Knowledge base not found.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="px-4 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <Link
                to="/knowledge-base"
                className="inline-flex items-center gap-0.5 hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
                Knowledge base
              </Link>
              <span>/</span>
              <span className="truncate text-foreground">{kb.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-full md:hidden"
                onClick={() => setMobileSearchOpen(true)}
              >
                <Search className="size-3.5" />
                Try Search
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => toast.message("Edit (demo)")}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button className="rounded-full" onClick={() => inputRef.current?.click()}>
                <Upload className="size-3.5" />
                Upload
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <section className="no-scrollbar mt-5 flex min-w-0 items-center gap-3 overflow-x-auto rounded-xl border border-border bg-card px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <AsciiIcon kind="folder" tone="amber" size="sm" />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h1 className="min-w-0 max-w-[min(40%,12rem)] shrink truncate text-sm font-semibold tracking-tight">
                    {kb.name}
                  </h1>
                </TooltipTrigger>
                <TooltipContent>{kb.name}</TooltipContent>
              </Tooltip>
              {kb.description ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {kb.description}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>{kb.description}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground sm:gap-2.5 sm:text-sm">
              <span className="shrink-0 tabular-nums">
                {totalFiles} file{totalFiles === 1 ? "" : "s"}
              </span>
              <MetaDot />
              <span className="shrink-0 tabular-nums">{formatBytes(totalSize)}</span>
              <MetaDot />
              <StatusChip className="shrink-0" status={kb.status} />
              <MetaDot />
              <span className="shrink-0 tabular-nums">
                {new Date(kb.created_at).toLocaleDateString()}
              </span>
              <MetaDot />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex min-w-0 max-w-[6.5rem] items-center gap-1 rounded-md hover:text-foreground sm:max-w-[8rem]"
                    onClick={() => {
                      void navigator.clipboard.writeText(kb.id);
                      toast.message("Copied KB ID");
                    }}
                  >
                    <span className="min-w-0 truncate font-mono text-xs">{kb.id}</span>
                    <Copy className="size-3 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs font-mono">{kb.id}</TooltipContent>
              </Tooltip>
            </div>
          </section>

          <section className="mt-5">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span>Name</span>
                <span>Size</span>
                <span>Status</span>
                <span>Chunks</span>
                <span className="w-8" />
              </div>
              <ul className="divide-y divide-border">
                {files.map((f) => (
                  <QuickContextMenu
                    key={f.id}
                    title={f.name}
                    items={[
                      {
                        label: "Copy name",
                        icon: Copy,
                        onSelect: () => {
                          void navigator.clipboard.writeText(f.name);
                          toast.message("Name copied");
                        },
                      },
                      { type: "separator" },
                      {
                        label: "Delete",
                        icon: Trash2,
                        variant: "destructive",
                        onSelect: async () => {
                          await deleteKnowledgeFile(id, f.id);
                          toast.message("File deleted");
                          void refresh();
                        },
                      },
                    ]}
                  >
                    <li className="grid cursor-context-menu grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                          {f.name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(f.size_bytes)}</span>
                      <StatusChip status={f.status} />
                      <span className="text-sm text-muted-foreground">{f.chunk_count}</span>
                      <Button variant="ghost" size="icon-sm" aria-label="File options">
                        <MoreVertical className="size-4" />
                      </Button>
                    </li>
                  </QuickContextMenu>
                ))}
              </ul>
              <div className="border-t border-border px-3">
                <VoicePagination
                  page={page}
                  perPage={perPage}
                  total={totalFiles}
                  onPageChange={setPage}
                  onPerPageChange={setPerPage}
                  perPageOptions={[10, 20, 50]}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="hidden h-full min-h-0 w-[340px] shrink-0 flex-col border-l border-border bg-background md:flex xl:w-[380px]">
        <RetrievalPanel
          inputId="kb-question"
          question={question}
          searching={searching}
          results={results}
          onQuestionChange={setQuestion}
          onSearch={() => void runSearch()}
        />
      </aside>

      <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Test retrieval</SheetTitle>
          <RetrievalPanel
            inputId="kb-question-mobile"
            headerClassName="pr-12"
            question={question}
            searching={searching}
            results={results}
            onQuestionChange={setQuestion}
            onSearch={() => void runSearch()}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RetrievalPanel({
  question,
  searching,
  results,
  onQuestionChange,
  onSearch,
  inputId = "kb-question",
  headerClassName,
}: {
  question: string;
  searching: boolean;
  results: RetrievalHit[] | null;
  onQuestionChange: (value: string) => void;
  onSearch: () => void;
  inputId?: string;
  headerClassName?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("shrink-0 px-4 pb-3 pt-4", headerClassName)}>
        <h2 className="text-sm font-semibold tracking-tight">Test retrieval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview what agents will find in this knowledge base.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>Question</Label>
          <Textarea
            id={inputId}
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="What does this knowledge base say about…?"
            rows={4}
            className="min-h-24 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSearch();
              }
            }}
          />
        </div>
        <Button
          className="w-full rounded-full"
          onClick={onSearch}
          disabled={!question.trim()}
          loading={searching}
        >
          {searching ? "Searching…" : (
            <>
              <Search className="size-4" />
              Try Search
            </>
          )}
        </Button>

        <div className="min-h-0 flex-1 overflow-y-auto pt-1">
          {results == null ? (
            <p className="text-sm text-muted-foreground">Results show up here.</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching chunks found.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i} className="rounded-xl border border-border px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {(r.similarity * 100).toFixed(0)}% match
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{r.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaDot({ className }: { className?: string }) {
  return (
    <span className={cn("shrink-0 text-border", className)} aria-hidden>
      ·
    </span>
  );
}
