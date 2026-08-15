"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Copy,
  MoreVertical,
  Pencil,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { VoicePagination } from "@/components/voice-agents/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getKnowledgeBase,
  listKnowledgeFiles,
  searchKnowledgeBase,
  uploadKnowledgeFile,
} from "@/lib/api/voice/knowledge-bases";
import type { VoiceKnowledgeBase, VoiceKnowledgeFile } from "@/lib/api/voice/types";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VoiceAgentsKnowledgeDetailPage() {
  const { id = "" } = useParams();
  const [kb, setKb] = useState<VoiceKnowledgeBase | null>(null);
  const [files, setFiles] = useState<VoiceKnowledgeFile[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [question, setQuestion] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ content: string; similarity: number }> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
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
    }
  }, [id, page, perPage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalSize = files.reduce((s, f) => s + f.size_bytes, 0);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length) return;
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

  if (!kb) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <Link
          to="/voice-agents/knowledge-base"
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
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <Link
            to="/voice-agents/knowledge-base"
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

      {/* Overview card */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <AsciiIcon kind="folder" tone="amber" size="sm" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{kb.name}</h1>
            <p className="text-sm text-muted-foreground">{kb.description}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Files" value={`${totalFiles} file${totalFiles === 1 ? "" : "s"}`} />
          <Stat
            label="Size"
            value={`${(totalSize / (1024 * 1024)).toFixed(1)} MB`}
          />
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge
              className={cn(
                "mt-1 font-normal",
                kb.status === "processing" &&
                  "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
              )}
            >
              {kb.status === "processing" ? "Processing" : kb.status}
            </Badge>
          </div>
          <Stat label="Created" value={new Date(kb.created_at).toLocaleDateString()} />
          <div>
            <p className="text-xs text-muted-foreground">KB ID</p>
            <button
              type="button"
              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm hover:underline"
              onClick={() => {
                void navigator.clipboard.writeText(kb.id);
                toast.message("Copied KB ID");
              }}
            >
              <span className="truncate">{kb.id.slice(0, 12)}…{kb.id.slice(-4)}</span>
              <Copy className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
      </section>

      {/* Files */}
      <section className="mt-8">
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
              <li
                key={f.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                    {f.name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{formatBytes(f.size_bytes)}</span>
                <Badge
                  className={cn(
                    "font-normal",
                    f.status === "processing" &&
                      "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
                  )}
                >
                  {f.status === "processing" ? "Processing" : f.status}
                </Badge>
                <span className="text-sm text-muted-foreground">{f.chunk_count}</span>
                <Button variant="ghost" size="icon-sm" aria-label="File options">
                  <MoreVertical className="size-4" />
                </Button>
              </li>
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

      {/* Test retrieval */}
      <section className="mt-8 rounded-2xl border border-sky-200/80 bg-sky-50/60 p-5 dark:border-sky-900 dark:bg-sky-950/30">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 size-4 text-sky-700 dark:text-sky-300" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Test retrieval</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ask a question to preview what agents will find in this knowledge
              base.
            </p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="kb-question">Question</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="kb-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What does this knowledge base say about...?"
                  className="h-10 rounded-xl bg-background"
                  onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                />
                <Button className="rounded-full" onClick={() => void runSearch()} disabled={searching}>
                  <Search className="size-4" />
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>
            </div>
            {results ? (
              <ul className="mt-4 space-y-2">
                {results.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No matching chunks found.</li>
                ) : (
                  results.map((r, i) => (
                    <li key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{(r.similarity * 100).toFixed(0)}% match</p>
                      <p className="mt-1 text-sm">{r.content}</p>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
