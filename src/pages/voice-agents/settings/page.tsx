"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { VoicePageHeader, VoicePagination } from "@/components/voice-agents/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createVoiceApiKey, listVoiceApiKeys, revokeVoiceApiKey } from "@/lib/api/voice/api-keys";
import type { VoiceApiKey } from "@/lib/api/voice/types";
import { KupeWorkspaceSettings } from "@/pages/voice-agents/settings/workspace-sections";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  { id: "workspace", label: "Workspace" },
  { id: "keys", label: "API Key" },
] as const;

export default function VoiceAgentsSettingsPage() {
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]["id"]>("workspace");
  const [keys, setKeys] = useState<VoiceApiKey[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<VoiceApiKey | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setKeys(await listVoiceApiKeys());
    } catch {
      toast.error("Couldn't load API keys");
    }
  }, []);

  useEffect(() => {
    document.title = "Settings · Voice Agents · Kupe";
    void refresh();
  }, [refresh]);

  const pageItems = useMemo(
    () => keys.slice((page - 1) * perPage, page * perPage),
    [keys, page, perPage],
  );

  async function createKey() {
    setCreating(true);
    try {
      const row = await createVoiceApiKey(name.trim() || "Default key");
      setRevealedKey(row.key ?? null);
      setName("");
      void refresh();
      toast.message("API key created");
    } catch {
      toast.error("Couldn't create API key");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
      <VoicePageHeader
        title="Settings"
        actions={
          tab === "keys" && keys.length > 0 ? (
            <Button
              className="rounded-full"
              onClick={() => {
                setRevealedKey(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              Create API key
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 inline-flex rounded-full bg-muted/70 p-1">
        {SETTINGS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm transition-colors",
              tab === t.id
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "workspace" && (
        <div className="mt-6">
          <KupeWorkspaceSettings />
        </div>
      )}

      {tab === "keys" && keys.length === 0 ? (
        <AsciiEmptyState
          kind="key"
          tone="coral"
          title="Let's create your first API key"
          description="API keys for apps and agents."
          className="min-h-[55vh]"
          actions={
            <>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  toast.message("Docs (demo)", {
                    description: "API key docs are not wired yet.",
                  })
                }
              >
                Read docs
              </Button>
              <Button
                className="rounded-full"
                onClick={() => {
                  setRevealedKey(null);
                  setCreateOpen(true);
                }}
              >
                <Plus className="size-4" />
                Create API key
              </Button>
            </>
          }
        />
      ) : tab === "keys" ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Name</span>
            <span>Key</span>
            <span>Created</span>
            <span>Last used</span>
            <span className="w-8" />
          </div>
          <ul className="divide-y divide-border">
            {pageItems.map((k) => (
              <li
                key={k.id}
                className="grid grid-cols-[1fr_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-4 py-3"
              >
                <span className="truncate text-sm font-semibold">{k.name}</span>
                <span className="truncate font-mono text-sm text-muted-foreground">
                  {k.key_prefix}…
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(k.created_at).toLocaleDateString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${k.name}`}
                  onClick={() => setToDelete(k)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-3">
            <VoicePagination
              page={page}
              perPage={perPage}
              total={keys.length}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              perPageOptions={[5, 10, 20]}
            />
          </div>
        </div>
      ) : null}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setRevealedKey(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {revealedKey ? "Copy your API key" : "Create API key"}
            </DialogTitle>
          </DialogHeader>

          {revealedKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This key is shown once. Copy it now and store it securely.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {revealedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(revealedKey);
                    toast.message("API key copied");
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
              <DialogFooter>
                <Button
                  className="rounded-full"
                  onClick={() => {
                    setCreateOpen(false);
                    setRevealedKey(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production backend"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="rounded-full" onClick={() => void createKey()} disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete API key “{toDelete?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apps using this key stop working immediately. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!toDelete) return;
                await revokeVoiceApiKey(toDelete.id);
                setToDelete(null);
                void refresh();
                toast.message("API key deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
