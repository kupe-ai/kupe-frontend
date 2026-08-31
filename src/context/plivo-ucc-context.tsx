"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useFeatureFlags } from "@/context/feature-flags-context";
import { useWorkspaceOptional } from "@/context/workspace-context";
import type { PlivoUccSummaryOut } from "@/types";

const EMPTY_SUMMARY: PlivoUccSummaryOut = {
  actionable_count: 0,
  pending: 0,
  rejected: 0,
  overdue: 0,
  callback_url: null,
};

type PlivoUccContextValue = {
  summary: PlivoUccSummaryOut;
  nearestDeadlineAt: string | null;
  hasActionable: boolean;
  refresh: () => Promise<PlivoUccSummaryOut>;
  dismissAlert: () => void;
};

const PlivoUccContext = createContext<PlivoUccContextValue | null>(null);

function nearestDeadline(items: { deadline_at: string | null }[]): string | null {
  const times = items
    .map((c) => c.deadline_at)
    .filter((d): d is string => Boolean(d))
    .sort();
  return times[0] ?? null;
}

export function PlivoUccProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceOptional();
  const { isEnabled } = useFeatureFlags();
  const orgId = workspace?.org?.id;
  const enabled = Boolean(orgId) && isEnabled("feature_phone_numbers");

  const [summary, setSummary] = useState<PlivoUccSummaryOut>(EMPTY_SUMMARY);
  const [nearestDeadlineAt, setNearestDeadlineAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const deadlineRef = useRef<string | null>(null);
  deadlineRef.current = nearestDeadlineAt;

  const refresh = useCallback(
    async (opts?: { deadlines?: boolean }): Promise<PlivoUccSummaryOut> => {
      if (!orgId || !enabled) {
        setSummary(EMPTY_SUMMARY);
        setNearestDeadlineAt(null);
        return EMPTY_SUMMARY;
      }
      try {
        const next = await api.getPlivoUccSummary(orgId);
        setSummary(next);
        if (next.actionable_count === 0) {
          setNearestDeadlineAt(null);
          setDismissed(false);
          return next;
        }
        const needDeadlines = opts?.deadlines === true || !deadlineRef.current;
        if (needDeadlines) {
          const [pending, rejected] = await Promise.all([
            api.listPlivoUcc(orgId, { status: "pending" }).catch(() => ({ items: [], total: 0 })),
            api.listPlivoUcc(orgId, { status: "rejected" }).catch(() => ({ items: [], total: 0 })),
          ]);
          setNearestDeadlineAt(nearestDeadline([...pending.items, ...rejected.items]));
        }
        return next;
      } catch {
        return summaryRef.current;
      }
    },
    [orgId, enabled],
  );

  useEffect(() => {
    setDismissed(false);
    void refresh({ deadlines: true });
    if (!enabled) return;
    const tick = window.setInterval(() => void refresh({ deadlines: false }), 60_000);
    return () => window.clearInterval(tick);
  }, [orgId, enabled, refresh]);

  const dismissAlert = useCallback(() => setDismissed(true), []);

  const hasActionable = summary.actionable_count > 0;
  const dialogOpen = hasActionable && !dismissed;

  const value = useMemo(
    () => ({
      summary,
      nearestDeadlineAt,
      hasActionable,
      refresh: () => refresh({ deadlines: true }),
      dismissAlert,
    }),
    [summary, nearestDeadlineAt, hasActionable, refresh, dismissAlert],
  );

  return (
    <PlivoUccContext.Provider value={value}>
      {children}
      <PlivoUccAlertDialog
        open={dialogOpen}
        count={summary.actionable_count}
        nearestDeadlineAt={nearestDeadlineAt}
        onDismiss={dismissAlert}
      />
    </PlivoUccContext.Provider>
  );
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.length >= 10 ? iso.slice(0, 10) : null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PlivoUccAlertDialog({
  open,
  count,
  nearestDeadlineAt,
  onDismiss,
}: {
  open: boolean;
  count: number;
  nearestDeadlineAt: string | null;
  onDismiss: () => void;
}) {
  const deadline = formatDeadline(nearestDeadlineAt);
  const label = count === 1 ? "1 UCC complaint needs" : `${count} UCC complaints need`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" />
            UCC proof required
          </DialogTitle>
          <DialogDescription>
            {label} opt-in proof
            {deadline ? ` · nearest deadline ${deadline}` : ""}. TRAI gives 5 business days.
            Upload proof or the number can be barred.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={onDismiss}>
            See later
          </Button>
          <Button className="rounded-full" asChild>
            <Link to="/phone-numbers?tab=ucc" onClick={onDismiss}>
              Review complaints
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function usePlivoUcc() {
  const ctx = useContext(PlivoUccContext);
  if (!ctx) {
    throw new Error("usePlivoUcc must be used within PlivoUccProvider");
  }
  return ctx;
}

export function usePlivoUccOptional() {
  return useContext(PlivoUccContext);
}
