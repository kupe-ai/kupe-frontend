"use client";

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, MoreVertical, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DOCS_URL } from "@/config";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { VoicePageHeader, VoicePagination } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  archiveCallDatabase,
  createCallDatabase,
  listCallDatabases,
  type CallDatabase,
} from "@/lib/api/voice/databases";

export default function VoiceAgentsDatabasesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CallDatabase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCallDatabases({ search, page, page_size: perPage });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Couldn't load databases");
    } finally {
      setLoading(false);
    }
  }, [search, page, perPage]);

  useEffect(() => {
    document.title = "Databases · Voice Agents · Kupe";
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const created = await createCallDatabase({ name: trimmed, description });
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.message("Database created");
      navigate(`/databases/${created.id}`);
    } catch {
      toast.error("Couldn't create database");
    } finally {
      setSaving(false);
    }
  }

  const showEmptyState = !loading && items.length === 0 && !search;

  return (
    <div className="voice-page">
      <VoicePageHeader
        title="Databases"
        actions={
          !showEmptyState ? (
            <Button className="group/nav rounded-full" onClick={() => setCreateOpen(true)}>
              <KupeIcon name="plus" className="size-4" />
              Create database
            </Button>
          ) : undefined
        }
      />

      {showEmptyState ? (
        <AsciiEmptyState
          kind="batch"
          tone="sky"
          title="Create your first database"
          description="Tables of structured data extracted after every call."
          className="min-h-[60vh]"
          actions={
            <>
              <Button variant="outline" className="rounded-full" asChild>
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                  Read docs
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
              <Button className="group/nav rounded-full" onClick={() => setCreateOpen(true)}>
                <KupeIcon name="plus" className="size-4" />
                Create database
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
              placeholder="Search databases"
              className="pl-8"
            />
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {items.map((db) => (
              <QuickContextMenu
                key={db.id}
                items={[
                  { label: "Open", onSelect: () => navigate(`/databases/${db.id}`) },
                  {
                    label: "Archive",
                    onSelect: async () => {
                      try {
                        await archiveCallDatabase(db.id);
                        toast.message("Archived");
                        void refresh();
                      } catch {
                        toast.error("Couldn't archive");
                      }
                    },
                  },
                ]}
              >
                <Link
                  to={`/databases/${db.id}`}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/60",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{db.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {db.fields.length} columns
                      {db.source === "auto_agent" ? " · auto-created" : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            await archiveCallDatabase(db.id);
                            toast.message("Archived");
                            void refresh();
                          } catch {
                            toast.error("Couldn't archive");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Link>
              </QuickContextMenu>
            ))}
          </div>
          <VoicePagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
            perPageOptions={[10, 20, 50]}
          />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create database</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="db-name">Name</Label>
              <Input id="db-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="db-desc">Description</Label>
              <Textarea id="db-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={!name.trim() || saving}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
