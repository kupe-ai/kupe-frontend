import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Recording } from "@/types";

const PAGE_SIZE = 10;

type Props = { orgId: string };

function statusBadge(status: string) {
  if (status === "complete") return "success" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "recording" || status === "uploading" || status === "starting") return "warning" as const;
  return "secondary" as const;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export function RecordingsPanel({ orgId }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.listRecordings(orgId, { limit: PAGE_SIZE, offset });
        if (!cancelled) {
          setRecordings(page.items);
          setTotal(page.total);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, offset]);

  async function play(recording: Recording) {
    if (playingId === recording.id) {
      setPlayingId(null);
      setPlayUrl(null);
      setPlayError(null);
      return;
    }
    setPlayingId(recording.id);
    setPlayUrl(null);
    setPlayError(null);
    try {
      const { url } = await api.getPlaybackUrl(recording.id);
      setPlayUrl(url);
    } catch (e) {
      setPlayError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Call recordings</CardTitle>
          <CardDescription>All org recordings. Play complete files in the browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {recordings.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No recordings yet.</p>
          )}
          {recordings.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadge(r.status)}>{r.status}</Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  session {r.session_id.slice(0, 8)}…
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                </span>
                <span className="text-xs text-muted-foreground">{formatDuration(r.duration_seconds)}</span>
                {r.size_bytes != null && (
                  <span className="text-xs text-muted-foreground">
                    {(r.size_bytes / 1024).toFixed(0)} KB
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  disabled={r.status !== "complete"}
                  onClick={() => void play(r)}
                >
                  {playingId === r.id ? "Hide player" : "Play"}
                </Button>
              </div>
              {playingId === r.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {playError && (
                    <Alert variant="destructive">
                      <AlertDescription>{playError}</AlertDescription>
                    </Alert>
                  )}
                  {playUrl && (
                    <audio controls autoPlay className="w-full" src={playUrl}>
                      Your browser does not support audio playback.
                    </audio>
                  )}
                  {!playUrl && !playError && (
                    <p className="text-sm text-muted-foreground">Loading playback URL…</p>
                  )}
                </div>
              )}
            </div>
          ))}
          <PaginationControls total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
        </CardContent>
      </Card>
    </div>
  );
}
