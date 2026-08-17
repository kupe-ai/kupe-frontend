"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import type { BillingPlan, BillingSubscription } from "@/types";

const PLAN_BARS = [
  { color: "#2f5bd7", height: "40%" },
  { color: "#e2b93b", height: "56%" },
  { color: "#e07a3a", height: "74%" },
  { color: "#3aa76d", height: "92%" },
] as const;

const PLAN_META: Record<string, { blurb: string; bars: 1 | 2 | 3 | 4 }> = {
  payg: { blurb: "No commitment — prepay and draw down.", bars: 1 },
  business: { blurb: "Lower per-minute rate with monthly autopay.", bars: 2 },
  scale: { blurb: "Our best self-serve rate, autopay.", bars: 3 },
  enterprise: { blurb: "Custom pricing at volume, dedicated support.", bars: 4 },
};

function money(rupees: number | null | undefined) {
  if (rupees == null) return "Custom";
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function BillingPlanCards({
  orgId,
  canManage,
  onChanged,
}: {
  orgId: string | null | undefined;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [sub, setSub] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("1000");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.getPlans(),
        orgId ? api.getBillingSubscription(orgId) : Promise.resolve(null),
      ]);
      setPlans(p);
      // No subscription row yet == a brand-new org that's never subscribed
      // — always pay-as-you-go by default, and shown as the current plan.
      setSub(s ?? { org_id: orgId ?? "", plan_code: "payg", status: "active", overages_enabled: true, current_period_start: null, current_period_end: null, recommended_plan: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPlanCode = sub?.plan_code ?? "payg";

  async function payAsYouGoTopup(planCode: "payg" | "enterprise" = "payg") {
    if (!orgId) return;
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      toast.error("Enter a positive amount in INR");
      return;
    }
    setBusyPlan(planCode);
    try {
      const order = await api.createTopupOrder(orgId, Math.round(rupees * 100), planCode);
      // Checkout.js renders as an overlay on this same page — never a
      // redirect/new tab — so the buyer never leaves the app mid-purchase.
      const result = await openRazorpayCheckout({
        key: order.key_id,
        amount: order.amount_minor_units,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: "Kupe credits",
        description: `Add ₹${rupees.toLocaleString("en-IN")} in voice-agent credits`,
        theme: { color: "#111827" },
      });
      await api.verifyTopupPayment(orgId, {
        razorpay_order_id: result.razorpay_order_id!,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      toast.success(`Added ₹${rupees.toLocaleString("en-IN")} to your wallet`);
      setAddOpen(false);
      void load();
      onChanged?.();
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusyPlan(null);
    }
  }

  async function subscribeToPlan(planCode: "business" | "scale") {
    if (!orgId) return;
    setBusyPlan(planCode);
    try {
      const subResult = await api.createSubscription(orgId, planCode);
      if (!subResult.razorpay_subscription_id || !subResult.key_id) throw new Error("Could not start subscription");
      await openRazorpayCheckout({
        key: subResult.key_id,
        subscription_id: subResult.razorpay_subscription_id,
        name: `Kupe ${planCode === "business" ? "Business" : "Scale"} plan`,
        description: "Monthly autopay — cancel any time from Manage subscription",
        theme: { color: "#111827" },
      });
      toast.success("Subscription set up — activating shortly");
      void load();
      onChanged?.();
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error(e instanceof Error ? e.message : "Could not start subscription");
    } finally {
      setBusyPlan(null);
    }
  }

  function talkToSales() {
    window.location.href = "mailto:sales@kupe.in?subject=" + encodeURIComponent("Enterprise plan enquiry");
  }

  return (
    <>
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(loading ? [] : plans).map((plan) => {
          const meta = PLAN_META[plan.code] ?? PLAN_META.payg;
          const isBusy = busyPlan === plan.code;
          const isCurrent = plan.code === currentPlanCode;
          const ctaLabel =
            isCurrent && plan.code !== "payg"
              ? "Current plan"
              : plan.code === "payg"
                ? isCurrent
                  ? "Add credits"
                  : "Switch & add credits"
                : plan.code === "enterprise"
                  ? "Talk to sales"
                  : "Subscribe";
          return (
            <div
              key={plan.code}
              className={cn(
                "flex h-full flex-col rounded-2xl border bg-card p-5 shadow-elevated group/nav",
                isCurrent ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
              )}
            >
              <PlanArt bars={meta.bars} title={plan.display_name} />
              <div className="mt-4 flex h-6 items-center justify-between gap-2">
                <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{plan.display_name}</p>
                {isCurrent && <Badge variant="success">Current</Badge>}
              </div>
              <p className="mt-1 h-7 text-xl leading-7 font-semibold tracking-tight">
                {plan.monthly_commitment_rupees ? `${money(plan.monthly_commitment_rupees)} /month` : "Pay as you go"}
              </p>
              <p className="mt-1 h-8 line-clamp-2 text-xs leading-4 text-muted-foreground">{meta.blurb}</p>

              <Button
                className="mt-4 h-9 w-full rounded-full"
                variant={isCurrent && plan.code !== "payg" ? "outline" : "default"}
                disabled={isBusy || !canManage || (isCurrent && plan.code !== "payg")}
                onClick={() => {
                  if (isCurrent && plan.code !== "payg") return;
                  if (plan.code === "payg") return setAddOpen(true);
                  if (plan.code === "enterprise") return talkToSales();
                  return subscribeToPlan(plan.code as "business" | "scale");
                }}
              >
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                {ctaLabel}
              </Button>
              {!canManage && (
                <p className="mt-2 text-center text-xs text-muted-foreground">Owner/admin only</p>
              )}

              <ul className="mt-5 flex-1 space-y-3">
                <PlanFeature text={`~${money(plan.voice_rate_rupees)} / minute`} note="Voice calls" show={plan.voice_rate_rupees != null} />
                <PlanFeature text={`₹${plan.telephony_rate_rupees ?? "—"} / minute`} note="Telephony" show={plan.telephony_rate_rupees != null} />
                <PlanFeature
                  text={`₹${plan.phone_rental_rupees_per_month ?? "—"} / month`}
                  note="Phone number rental"
                  show={plan.phone_rental_rupees_per_month != null}
                />
                {plan.code === "enterprise" && (
                  <>
                    <PlanFeature text="Custom concurrency & rate limits" show />
                    <PlanFeature text="Forward-deployed engineering support" show />
                    <PlanFeature text="Available on 1,00,000+ minutes/month" show />
                    <PlanFeature text={`Renewals from ${money(plan.min_topup_rupees)}`} show={plan.min_topup_rupees != null} />
                    {isCurrent && (
                      <li>
                        <Button size="sm" variant="outline" className="w-full rounded-full" disabled={!canManage} onClick={() => setAddOpen(true)}>
                          Renew credits
                        </Button>
                      </li>
                    )}
                  </>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="plan-credit-amount">Amount (₹)</Label>
            <Input
              id="plan-credit-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busyPlan === "payg" || busyPlan === "enterprise"}
            />
            <p className="text-xs text-muted-foreground">
              Payment opens right here — you'll pay via Razorpay's checkout and credits land the moment it's confirmed.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setAddOpen(false)}
              disabled={busyPlan === "payg" || busyPlan === "enterprise"}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => payAsYouGoTopup(currentPlanCode === "enterprise" ? "enterprise" : "payg")}
              disabled={busyPlan === "payg" || busyPlan === "enterprise"}
            >
              {busyPlan === "payg" || busyPlan === "enterprise" ? <Loader2 className="size-4 animate-spin" /> : null}
              Pay & add credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlanArt({ bars, title }: { bars: 1 | 2 | 3 | 4; title: string }) {
  const uid = useId().replace(/:/g, "");
  const shown = PLAN_BARS.slice(0, bars);

  return (
    <div
      role="img"
      aria-label={title}
      className="relative h-28 overflow-hidden rounded-xl bg-neutral-300 dark:bg-neutral-800"
    >
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-1.5 px-6">
        {shown.map((bar) => (
          <div
            key={bar.color}
            className="min-w-4 w-[18%] max-w-7"
            style={{
              height: bar.height,
              backgroundColor: bar.color,
              backgroundImage:
                "repeating-linear-gradient(0deg, rgb(0 0 0 / 0.14) 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.1) 0 2px, transparent 2px 4px)",
              boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.2)",
            }}
          />
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0 size-full mix-blend-overlay" aria-hidden>
        <filter id={`${uid}-grain`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${uid}-grain)`} opacity="0.7" />
      </svg>
    </div>
  );
}

function PlanFeature({ text, note, show }: { text: string; note?: string; show: boolean }) {
  if (!show) return null;
  return (
    <li className="flex gap-2 text-sm">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <div className="min-w-0">
        <span>{text}</span>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
    </li>
  );
}
