"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileDown, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import { api, type DisplayCurrency } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { VoicePagination } from "@/components/voice-agents/shared";
import { CurrencyToggle, UI_DEFAULT_CURRENCY, formatMoney } from "@/components/voice-agents/currency-toggle";
import type { Invoice, Wallet } from "@/types";

const PAGE_SIZE = 10;

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusVariant(status: string): "success" | "warning" | "secondary" {
  if (status === "paid") return "success";
  if (status === "open") return "warning";
  return "secondary";
}

export default function BillingPage() {
  const { org, membership } = useWorkspace();
  const [currency, setCurrency] = useState<DisplayCurrency>(UI_DEFAULT_CURRENCY);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingCredits, setAddingCredits] = useState(false);
  const canManageBalance = membership?.role === "owner" || membership?.role === "admin";

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const [w, inv] = await Promise.all([
        api.getWallet(org.id, { currency }),
        api.listInvoices(org.id, { currency, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
      ]);
      setWallet(w);
      setInvoices(inv.items);
      setTotal(inv.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [org, currency, page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [currency]);

  function refresh() {
    setRefreshKey((k) => k + 1);
    toast.message("Refreshing billing…");
  }

  async function addCredits() {
    if (!org) return;
    const input = window.prompt("Add credits — amount in INR (e.g. 100):");
    if (!input) return;
    const rupees = Number(input);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      toast.error("Enter a positive amount in INR");
      return;
    }
    setAddingCredits(true);
    try {
      await api.adjustBalance(org.id, Math.round(rupees * 100));
      toast.success(`Added ₹${rupees.toLocaleString()} to the wallet`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add credits");
    } finally {
      setAddingCredits(false);
    }
  }

  const insufficient = !loading && wallet?.unmetered === false && wallet.insufficient;

  return (
    <div className="voice-page voice-page-wide">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title">Billing</h1>
        <div className="flex items-center gap-2">
          <CurrencyToggle value={currency} onChange={setCurrency} disabled={loading} />
          {canManageBalance && (
            <Button variant="default" size="sm" onClick={addCredits} disabled={loading || addingCredits}>
              <Plus className="size-4" />
              Add credits
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {insufficient && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Insufficient balance — this workspace is out of credits. New calls and TTS generation are blocked until
            you top up.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Wallet balance"
          value={
            loading
              ? null
              : wallet?.unmetered
                ? "Unmetered"
                : formatMoney(wallet?.balance ?? 0, currency)
          }
          tone={insufficient ? "danger" : undefined}
        />
        <StatTile
          label="Credits added"
          value={
            loading
              ? null
              : wallet?.unmetered
                ? "—"
                : formatMoney(wallet?.credited ?? 0, currency)
          }
        />
        <StatTile
          label="Credits consumed"
          value={
            loading
              ? null
              : wallet?.unmetered
                ? "—"
                : formatMoney(wallet?.consumed ?? 0, currency)
          }
        />
        <StatTile label="Invoices" value={loading ? null : String(total)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-headline">Invoices</h2>
        </div>
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-headline">No invoices yet</p>
            <p className="text-caption mt-1">Wallet top-ups will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="text-caption px-5 py-2.5 font-medium">Invoice #</th>
                    <th className="text-caption px-5 py-2.5 font-medium">Status</th>
                    <th className="text-caption px-5 py-2.5 text-right font-medium">Amount</th>
                    <th className="text-caption px-5 py-2.5 font-medium">Date of Issue</th>
                    <th className="text-caption px-5 py-2.5 font-medium">Due Date</th>
                    <th className="text-caption px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs">{row.invoice_number}</td>
                      <td className="px-5 py-2.5">
                        <Badge variant={statusVariant(row.status)} className="capitalize">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                        {formatMoney(row.amount, row.currency || currency)}
                      </td>
                      <td className="px-5 py-2.5 whitespace-nowrap">{formatDate(row.issued_at)}</td>
                      <td className="px-5 py-2.5 whitespace-nowrap">{formatDate(row.due_at)}</td>
                      <td className="px-5 py-2.5 text-right">
                        {row.has_pdf ? (
                          <span className="inline-flex items-center gap-1 text-caption">
                            <FileDown className="size-3.5" />
                            PDF
                          </span>
                        ) : (
                          <span className="text-caption">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3">
              <VoicePagination
                page={page}
                perPage={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                onPerPageChange={() => {}}
                perPageOptions={[PAGE_SIZE]}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone?: "danger";
}) {
  return (
    <div
      className={
        tone === "danger"
          ? "rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-elevated"
          : "rounded-2xl border border-border bg-card p-5 shadow-elevated"
      }
    >
      <p className="text-caption">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-24 rounded-md" />
      ) : (
        <p
          className={
            tone === "danger"
              ? "mt-1 text-2xl font-semibold tracking-tight text-destructive"
              : "mt-1 text-2xl font-semibold tracking-tight text-foreground"
          }
        >
          {value}
        </p>
      )}
    </div>
  );
}
