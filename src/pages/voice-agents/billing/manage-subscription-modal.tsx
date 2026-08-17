"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { BillingPlan, BillingSubscription } from "@/types";

const PLAN_LABEL: Record<string, string> = {
  payg: "Pay as you go",
  business: "Business",
  scale: "Scale",
  enterprise: "Enterprise",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ManageSubscriptionModal({
  open,
  onOpenChange,
  orgId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onChanged?: () => void;
}) {
  const [sub, setSub] = useState<BillingSubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetPlan, setTargetPlan] = useState<string>("");
  const [busy, setBusy] = useState<"overages" | "change" | "cancel" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([api.getBillingSubscription(orgId), api.getPlans()]);
      setSub(s);
      setPlans(p.filter((pl) => pl.is_self_serve));
      setTargetPlan(s.plan_code);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function toggleOverages(enabled: boolean) {
    setBusy("overages");
    try {
      const s = await api.setBillingOverages(orgId, enabled);
      setSub(s);
      toast.success(enabled ? "Overages enabled" : "Overages disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update overages");
    } finally {
      setBusy(null);
    }
  }

  async function applyPlanChange() {
    if (!targetPlan || targetPlan === sub?.plan_code) return;
    setBusy("change");
    try {
      const result = await api.changeSubscription(orgId, targetPlan);
      if (result.razorpay_subscription_id && result.key_id) {
        flushSync(() => onOpenChange(false));
        await openRazorpayCheckout({
          key: result.key_id,
          subscription_id: result.razorpay_subscription_id,
          name: `Kupe ${PLAN_LABEL[targetPlan] ?? targetPlan} plan`,
          description: "Monthly autopay — takes effect next billing cycle",
          theme: { color: "#111827" },
        });
      }
      toast.success(`Switching to ${PLAN_LABEL[targetPlan] ?? targetPlan} — effective next billing cycle`);
      onChanged?.();
      void load();
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error(e instanceof Error ? e.message : "Could not change plan");
    } finally {
      setBusy(null);
    }
  }

  async function cancelPlan() {
    if (!window.confirm("Cancel your current plan and move to pay-as-you-go at the end of this billing cycle?")) return;
    setBusy("cancel");
    try {
      await api.changeSubscription(orgId, "payg");
      toast.success("Plan will move to pay-as-you-go at the end of this cycle");
      onChanged?.();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel plan");
    } finally {
      setBusy(null);
    }
  }

  const changeableTargets = plans.filter((p) => p.code !== "enterprise");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage subscription</DialogTitle>
        </DialogHeader>

        {loading || !sub ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {sub.recommended_plan && sub.recommended_plan !== sub.plan_code && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                Based on your recent usage, {PLAN_LABEL[sub.recommended_plan] ?? sub.recommended_plan} would likely cost you less.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 text-sm">
              <div>
                <p className="text-caption">Current plan</p>
                <p className="font-medium">{PLAN_LABEL[sub.plan_code] ?? sub.plan_code}</p>
              </div>
              <div className="text-right">
                <p className="text-caption">Status</p>
                <p className="font-medium capitalize">{sub.status}</p>
              </div>
              <div>
                <p className="text-caption">Renews on</p>
                <p className="font-medium">{formatDate(sub.current_period_end)}</p>
              </div>
              <div className="text-right">
                <p className="text-caption">Started</p>
                <p className="font-medium">{formatDate(sub.current_period_start)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Enable overages</p>
                <p className="text-xs text-muted-foreground">
                  Keep taking calls at the pay-as-you-go rate once this cycle's credits run out.
                </p>
              </div>
              <Switch checked={sub.overages_enabled} disabled={busy === "overages"} onCheckedChange={toggleOverages} />
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-sm font-medium">Modify plan</p>
              <div className="flex items-center gap-2">
                <Select value={targetPlan} onValueChange={setTargetPlan}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {changeableTargets.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.display_name}
                        {p.monthly_commitment_rupees ? ` — ₹${p.monthly_commitment_rupees.toLocaleString("en-IN")}/mo` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={applyPlanChange}
                  disabled={busy === "change" || targetPlan === sub.plan_code}
                >
                  {busy === "change" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Apply
                </Button>
              </div>
              {sub.plan_code !== "payg" && (
                <Button variant="outline" size="sm" className="w-full" onClick={cancelPlan} disabled={busy === "cancel"}>
                  {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Cancel plan
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
