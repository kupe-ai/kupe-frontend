"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Matrix } from "@/components/ui/matrix";
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
import { api, type DisplayCurrency } from "@/lib/api";
import { openRazorpayCheckout, preloadRazorpayCheckout } from "@/lib/razorpay";
import type { BillingPlan, BillingSubscription } from "@/types";

const PLAN_META: Record<string, { blurb: string; bars: 1 | 2 | 3 | 4; showDiscount?: boolean }> = {
  payg: { blurb: "No commitment — prepay and draw down.", bars: 1, showDiscount: true },
  business: { blurb: "Lower per-minute rate with monthly autopay.", bars: 2, showDiscount: true },
  scale: { blurb: "Our best self-serve rate, autopay.", bars: 3, showDiscount: true },
  enterprise: { blurb: "Custom pricing at volume, dedicated support.", bars: 4 },
};

function planCurrency(plan: BillingPlan, fallback: DisplayCurrency): DisplayCurrency {
  return plan.currency === "USD" || plan.currency === "INR" ? plan.currency : fallback;
}

function planAmount(plan: BillingPlan, key: "voice" | "telephony" | "rental" | "monthly" | "topup" | "list"): number | null {
  const generic = {
    voice: plan.voice_rate,
    telephony: plan.telephony_rate,
    rental: plan.phone_rental_per_month,
    monthly: plan.monthly_commitment,
    topup: plan.min_topup,
    list: plan.list_voice_rate,
  }[key];
  if (generic != null) return generic;
  const legacy = {
    voice: plan.voice_rate_rupees,
    telephony: plan.telephony_rate_rupees,
    rental: plan.phone_rental_rupees_per_month,
    monthly: plan.monthly_commitment_rupees,
    topup: plan.min_topup_rupees ?? null,
    list: null,
  }[key];
  return legacy ?? null;
}

function money(amount: number | null | undefined, currency: DisplayCurrency, digits?: number) {
  if (amount == null) return "Custom";
  const symbol = currency === "USD" ? "$" : "₹";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const max = digits ?? (currency === "USD" ? 4 : 2);
  const min = digits === 0 ? 0 : Math.min(2, max);
  return `${symbol}${amount.toLocaleString(locale, { maximumFractionDigits: max, minimumFractionDigits: min })}`;
}

/** Nearest 5% from list → charged (optical only). */
function approxOffPct(final: number, list: number) {
  if (list <= 0 || final >= list) return undefined;
  const stepped = Math.round((((list - final) / list) * 100) / 5) * 5;
  return stepped > 0 ? stepped : undefined;
}

function listFromDiscount(final: number, pct: number) {
  return final / (1 - pct / 100);
}

export function BillingPlanCards({
  orgId,
  canManage,
  onChanged,
  currency = "INR",
}: {
  orgId: string | null | undefined;
  canManage: boolean;
  onChanged?: () => void;
  /** Display currency for plan rates (API converts INR storage). */
  currency?: DisplayCurrency;
}) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [sub, setSub] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.getPlans({ currency }),
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
  }, [orgId, currency]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    preloadRazorpayCheckout();
  }, []);

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
      // Drop the Radix dialog so Checkout.js can embed on this page (focus trap
      // + pointer-events:none on body otherwise push Razorpay to a blank hosted page).
      flushSync(() => setAddOpen(false));
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
          const shownCurrency = planCurrency(plan, currency);
          const voiceRate = planAmount(plan, "voice");
          const telephonyRate = planAmount(plan, "telephony");
          const rentalRate = planAmount(plan, "rental");
          const monthly = planAmount(plan, "monthly");
          const minTopup = planAmount(plan, "topup");
          const listVoice = planAmount(plan, "list");
          const discountPct =
            meta.showDiscount && voiceRate != null && listVoice != null
              ? approxOffPct(voiceRate, listVoice)
              : undefined;
          const listMonthly =
            discountPct && monthly
              ? shownCurrency === "INR"
                ? Math.round(listFromDiscount(monthly, discountPct) / 1000) * 1000
                : Math.round(listFromDiscount(monthly, discountPct) * 100) / 100
              : null;
          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border bg-card p-5 shadow-elevated",
                isCurrent ? "border-primary/55 ring-1 ring-primary/35" : "border-border",
              )}
              onMouseEnter={() => setHoveredPlan(plan.code)}
              onMouseLeave={() => setHoveredPlan((code) => (code === plan.code ? null : code))}
            >
              <PlanArt
                bars={meta.bars}
                planCode={plan.code}
                currency={currency}
                title={plan.display_name}
                hovered={hoveredPlan === plan.code}
              />
              <div className="relative mt-4 flex min-h-6 items-center justify-between gap-2">
                <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{plan.display_name}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {discountPct ? (
                    <Badge variant="default" className="h-5 px-1.5 text-[10px] font-semibold">
                      {discountPct}% off
                    </Badge>
                  ) : null}
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
              </div>
              <div className="relative mt-1 min-h-7">
                {listMonthly ? (
                  <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/70">
                    {money(listMonthly, shownCurrency, shownCurrency === "INR" ? 0 : 2)} /month
                  </p>
                ) : null}
                <p className="text-xl leading-7 font-semibold tracking-tight">
                  {monthly ? `${money(monthly, shownCurrency, shownCurrency === "INR" ? 0 : 2)} /month` : "Pay as you go"}
                </p>
              </div>
              <p className="relative mt-1 h-8 line-clamp-2 text-xs leading-4 text-muted-foreground">{meta.blurb}</p>

              <Button
                className={cn(
                  "relative mt-4 h-9 w-full rounded-full",
                  !(isCurrent && plan.code !== "payg") && "hover:brightness-110",
                )}
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

              <ul className="relative mt-5 flex-1 space-y-3">
                <PlanFeature
                  text={`~${money(voiceRate, shownCurrency)} / minute`}
                  was={discountPct && listVoice != null ? `~${money(listVoice, shownCurrency)} / minute` : undefined}
                  note="Voice calls"
                  show={voiceRate != null}
                />
                <PlanFeature text={`${money(telephonyRate, shownCurrency)} / minute`} note="Telephony" show={telephonyRate != null} />
                <PlanFeature
                  text={`${money(rentalRate, shownCurrency)} / month`}
                  note="Phone number rental"
                  show={rentalRate != null}
                />
                {plan.code === "enterprise" && (
                  <>
                    <PlanFeature text="Custom concurrency & rate limits" show />
                    <PlanFeature text="Forward-deployed engineering support" show />
                    <PlanFeature text="Available on 1,00,000+ minutes/month" show />
                    <PlanFeature text={`Renewals from ${money(minTopup, shownCurrency, shownCurrency === "INR" ? 0 : 2)}`} show={minTopup != null} />
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

const MATRIX_GAP = 3;
const MATRIX_TARGET = 7;
const PLAN_BAR_HEIGHTS = [0.4, 0.56, 0.74, 0.92] as const;
const ICON_VALUE = 0.92;

/** Compact pixel glyphs stamped into the muted right zone. */
const ICON_RUPEE: number[][] = [
  [1, 1, 1],
  [1, 0, 0],
  [1, 1, 0],
  [1, 0, 0],
  [0, 1, 0],
];
const ICON_DOLLAR: number[][] = [
  [0, 1, 0],
  [1, 1, 1],
  [1, 1, 0],
  [0, 1, 1],
  [1, 1, 1],
  [0, 1, 0],
];
/** Briefcase — starter / business. */
const ICON_BRIEFCASE: number[][] = [
  [0, 1, 0],
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];
/** Rising stairs — scale. */
const ICON_SCALE: number[][] = [
  [0, 0, 1],
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];
/** Building — enterprise. */
const ICON_BUILDING: number[][] = [
  [0, 1, 0],
  [1, 0, 1],
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];

function planIcon(planCode: string, currency: DisplayCurrency): number[][] {
  if (planCode === "payg") return currency === "USD" ? ICON_DOLLAR : ICON_RUPEE;
  if (planCode === "business") return ICON_BRIEFCASE;
  if (planCode === "scale") return ICON_SCALE;
  return ICON_BUILDING;
}

function stampIcon(frame: number[][], icon: number[][], originRow: number, originCol: number) {
  const rows = frame.length;
  const cols = frame[0]?.length ?? 0;
  for (let r = 0; r < icon.length; r++) {
    for (let c = 0; c < (icon[r]?.length ?? 0); c++) {
      if (!(icon[r]![c]! > 0)) continue;
      const rr = originRow + r;
      const cc = originCol + c;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
        frame[rr]![cc] = ICON_VALUE;
      }
    }
  }
}

function planArtPattern(
  rows: number,
  cols: number,
  barCount: 1 | 2 | 3 | 4,
  planCode: string,
  currency: DisplayCurrency,
): number[][] {
  const frame = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const icon = planIcon(planCode, currency);
  const iconW = icon[0]?.length ?? 3;
  const iconH = icon.length;
  // Keep a muted gutter + icon zone on the right so bars never eat the glyph.
  const iconZone = Math.min(cols, iconW + 3);
  const barZone = Math.max(barCount * 2, cols - iconZone - 1);

  const shown = PLAN_BAR_HEIGHTS.slice(0, barCount);
  const gapCols = 1;
  let barWidth = Math.max(1, Math.round(barZone * 0.14));
  const maxWidth = Math.max(1, Math.floor((barZone - (barCount - 1) * gapCols) / barCount));
  barWidth = Math.min(barWidth, maxWidth);
  const total = barCount * barWidth + Math.max(0, barCount - 1) * gapCols;
  const start = Math.max(0, Math.min(1, barZone - total));

  shown.forEach((h, i) => {
    const barRows = Math.max(2, Math.round(h * rows));
    const col0 = start + i * (barWidth + gapCols);
    for (let r = rows - barRows; r < rows; r++) {
      const t = (r - (rows - barRows) + 1) / barRows;
      const value = 0.72 + 0.28 * t;
      for (let c = 0; c < barWidth; c++) {
        const col = col0 + c;
        if (col >= 0 && col < cols) frame[r]![col] = value;
      }
    }
  });

  if (cols >= iconW + 3 && rows >= iconH + 1) {
    const originCol = Math.max(barZone + 1, cols - iconW - 2);
    const originRow = Math.max(0, Math.floor((rows - iconH) / 2));
    stampIcon(frame, icon, originRow, originCol);
  }

  return frame;
}

function PlanArt({
  bars,
  planCode,
  currency,
  title,
  hovered,
}: {
  bars: 1 | 2 | 3 | 4;
  planCode: string;
  currency: DisplayCurrency;
  title: string;
  hovered: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (width: number, height: number) => {
      const w = Math.round(width);
      const h = Math.round(height);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      update(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grid = useMemo(() => {
    const { w, h } = box;
    if (w < 8 || h < 8) return null;
    const cols = Math.max(6, Math.round((w + MATRIX_GAP) / (MATRIX_TARGET + MATRIX_GAP)));
    const size = (w - MATRIX_GAP * (cols - 1)) / cols;
    const rows = Math.max(4, Math.floor((h + MATRIX_GAP) / (size + MATRIX_GAP)));
    return {
      cols,
      rows,
      size,
      pattern: planArtPattern(rows, cols, bars, planCode, currency),
    };
  }, [box, bars, planCode, currency]);

  return (
    <div ref={ref} className="flex h-28 w-full items-center justify-center overflow-hidden">
      {grid ? (
        <Matrix
          rows={grid.rows}
          cols={grid.cols}
          size={grid.size}
          gap={MATRIX_GAP}
          pattern={grid.pattern}
          scrambleOnHover
          showOffDots
          hovered={hovered}
          className="flex h-full w-full items-center justify-center"
          palette={{ on: "var(--primary)", off: "var(--muted-foreground)" }}
          ariaLabel={title}
        />
      ) : null}
    </div>
  );
}

function PlanFeature({
  text,
  was,
  note,
  show,
}: {
  text: string;
  was?: string;
  note?: string;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <li className="flex gap-2 text-sm">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <div className="min-w-0">
        {was ? (
          <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/70">{was}</p>
        ) : null}
        <span>{text}</span>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
    </li>
  );
}
