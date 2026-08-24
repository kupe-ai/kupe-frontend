"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Copy,
  ExternalLink,
  FileText,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DOCS_URL } from "@/config";
import { KupeIcon } from "@/components/icons/kupe-icon";
import {
  AsciiEmptyState,
  AsciiIcon,
} from "@/components/voice-agents/ascii-icons";
import {
  VoicePageHeader,
  VoicePagination,
} from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { RenameDialog } from "@/components/rename-dialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Matrix, loader } from "@/components/ui/matrix";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
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
  createKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBases,
  updateKnowledgeBase,
  uploadKnowledgeFile,
} from "@/lib/api/voice/knowledge-bases";
import type { VoiceKnowledgeBase } from "@/lib/api/voice/types";

function suggestFolderName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return slug.length >= 3 ? `kb-${slug}`.slice(0, 32) : `kb-${Date.now().toString(36)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VoiceAgentsKnowledgePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<VoiceKnowledgeBase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<VoiceKnowledgeBase | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKnowledgeBases({ search, page, page_size: perPage });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Couldn't load knowledge bases");
    } finally {
      setLoading(false);
    }
  }, [search, page, perPage]);

  useEffect(() => {
    document.title = "Knowledge base · Voice Agents · Kupe";
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

  function handleCreated(kb: VoiceKnowledgeBase) {
    setCreateOpen(false);
    toast.message("Knowledge base created");
    navigate(`/knowledge-base/${kb.id}`);
  }

  const showEmptyState = !loading && items.length === 0 && !search;

  return (
    <div className="voice-page">
      <VoicePageHeader
        title="Knowledge base"
        actions={
          !showEmptyState ? (
            <Button className="group/nav rounded-full" onClick={() => setCreateOpen(true)}>
              <KupeIcon name="plus" className="size-4" />
              Create knowledge base
            </Button>
          ) : undefined
        }
      />

      {showEmptyState ? (
        <AsciiEmptyState
          kind="folder"
          tone="amber"
          title="Create your first knowledge base"
          description="Files your agents can use on calls."
          className="min-h-[60vh]"
          actions={
            <>
              <Button
                variant="outline"
                className="rounded-full"
                asChild
              >
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                  Read docs
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
              <Button className="group/nav rounded-full" onClick={() => setCreateOpen(true)}>
                <KupeIcon name="plus" className="size-4" />
                Create knowledge base
              </Button>
            </>
          }
        />
      ) : (
        <div className="mt-6">
          <div className="relative mb-4 max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge bases"
              className="h-10 rounded-full pl-8"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Status</span>
              <span>Created at</span>
              <span className="w-8" />
            </div>
            <ul className="divide-y divide-border">
              {items.map((kb) => (
                <QuickContextMenu
                  key={kb.id}
                  title={kb.name}
                  items={[
                    {
                      label: "Open",
                      icon: ExternalLink,
                      onSelect: () => navigate(`/knowledge-base/${kb.id}`),
                    },
                    { label: "Rename", icon: Pencil, onSelect: () => setRenaming(kb) },
                    {
                      label: "Copy name",
                      icon: Copy,
                      onSelect: () => {
                        void navigator.clipboard.writeText(kb.name);
                        toast.message("Name copied");
                      },
                    },
                    { type: "separator" },
                    {
                      label: "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      onSelect: async () => {
                        await deleteKnowledgeBase(kb.id);
                        void refresh();
                        toast.message("Knowledge base deleted");
                      },
                    },
                  ]}
                >
                  <li className="cursor-context-menu">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <Link
                        to={`/knowledge-base/${kb.id}`}
                        className="flex min-w-0 items-center gap-3 hover:opacity-90"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                          <AsciiIcon kind="folder" tone="amber" size="sm" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{kb.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {kb.description || "—"}
                          </p>
                        </div>
                      </Link>
                      <StatusChip status={kb.status} />
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {new Date(kb.created_at).toLocaleDateString()}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Knowledge base options"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              navigate(`/knowledge-base/${kb.id}`)
                            }
                          >
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setRenaming(kb)}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={async () => {
                              await deleteKnowledgeBase(kb.id);
                              void refresh();
                              toast.message("Knowledge base deleted");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                </QuickContextMenu>
              ))}
            </ul>
            <div className="border-t border-border px-3">
              <VoicePagination
                page={page}
                perPage={perPage}
                total={total}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                perPageOptions={[10, 20, 50]}
              />
            </div>
          </div>
        </div>
      )}

      <CreateKnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <RenameDialog
        open={Boolean(renaming)}
        onOpenChange={(next) => {
          if (!next) setRenaming(null);
        }}
        title="Rename knowledge base"
        initial={renaming?.name ?? ""}
        onSubmit={async (name) => {
          if (!renaming) return;
          await updateKnowledgeBase(renaming.id, { name });
          setRenaming(null);
          toast.message("Knowledge base renamed");
          void refresh();
        }}
      />
    </div>
  );
}

function CreateKnowledgeBaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (kb: VoiceKnowledgeBase) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setName("");
      setDescription("");
      setSubmitting(false);
    }
  }, [open]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = Array.from(list);
    setFiles((prev) => [...prev, ...next]);
    if (!name.trim() && next[0]) {
      setName(suggestFolderName(next[0].name));
    }
  }

  async function create() {
    const folder = name.trim();
    if (files.length === 0) {
      toast.message("Add at least one file");
      return;
    }
    if (folder.length < 3 || folder.length > 32) {
      toast.message("Folder name must be 3–32 characters");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(folder)) {
      toast.message("Use lowercase letters, digits, hyphens, or underscores");
      return;
    }
    setSubmitting(true);
    try {
      const kb = await createKnowledgeBase({ name: folder, description });
      await Promise.all(files.map((f) => uploadKnowledgeFile(kb.id, f)));
      onCreated(kb);
    } catch {
      toast.error("Couldn't create knowledge base");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Create knowledge base</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          <div
            className={cn(
              "flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <AsciiIcon kind="upload" tone="slate" size="md" />
            <p className="mt-3 text-sm font-semibold">
              Click or drop files to upload
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              PDF, Word, PowerPoint, text, Markdown, HTML, CSV, Excel, or JSON
            </p>
            <Button
              type="button"
              className="mt-4 rounded-full"
              onClick={() => inputRef.current?.click()}
            >
              Browse files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {submitting ? "Uploading…" : formatBytes(f.size)}
                    </p>
                  </div>
                  {submitting ? (
                    <Matrix
                      rows={7}
                      cols={7}
                      frames={loader}
                      fps={12}
                      size={1.6}
                      gap={0.5}
                      palette={{ on: "var(--primary)", off: "transparent" }}
                      ariaLabel="Uploading"
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove file"
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="kb-name">Folder name</Label>
            <Input
              id="kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="kb-example"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, hyphens, or underscores · 3-32
              characters
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kb-desc">Description (optional)</Label>
            <Textarea
              id="kb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={create} loading={submitting}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
