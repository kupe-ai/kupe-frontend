"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  attachCallDatabaseAgent,
  detachCallDatabaseAgent,
  listAgentCallDatabases,
  listCallDatabases,
  type CallDatabase,
} from "@/lib/api/voice/databases";
import { useFeatureFlags } from "@/context/feature-flags-context";

export function AgentDatabasesPanel({ agentId }: { agentId: string }) {
  const { isEnabled } = useFeatureFlags();
  const [attached, setAttached] = useState<CallDatabase[]>([]);
  const [available, setAvailable] = useState<CallDatabase[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, all] = await Promise.all([
        listAgentCallDatabases(agentId),
        listCallDatabases({ page_size: 100 }),
      ]);
      setAttached(mine);
      setAvailable(all.items.filter((d) => !mine.some((m) => m.id === d.id)));
    } catch {
      toast.error("Couldn't load databases");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (isEnabled("feature_databases")) void refresh();
  }, [isEnabled, refresh]);

  if (!isEnabled("feature_databases")) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Databases</h2>
        <p className="text-sm text-muted-foreground">
          Extracted call data lands in attached databases after every call.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="space-y-2">
            {attached.map((db) => (
              <div key={db.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Link to={`/databases/${db.id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                  {db.name}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await detachCallDatabaseAgent(db.id, agentId);
                      void refresh();
                    } catch {
                      toast.error("Couldn't detach");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!attached.length && (
              <p className="text-sm text-muted-foreground">No database attached yet.</p>
            )}
          </div>
          <Select
            onValueChange={async (databaseId) => {
              try {
                await attachCallDatabaseAgent(databaseId, agentId);
                void refresh();
              } catch {
                toast.error("Couldn't attach database");
              }
            }}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Attach a database" />
            </SelectTrigger>
            <SelectContent>
              {available.map((db) => (
                <SelectItem key={db.id} value={db.id}>
                  {db.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}
