"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  AsciiIcon,
  type AsciiIconKind,
  type AsciiIconTone,
} from "@/components/voice-agents/ascii-icons";
import { useWorkspace } from "@/context/workspace-context";
import { api } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { Button } from "@/components/ui/button";
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
import type { BillingPlan, Wallet } from "@/types";

const PLAN_META: Record<
  string,
  { kind: AsciiIconKind; tone: AsciiIconTone; blurb: string }
> = {
  payg: { kind: "planStarter", tone: "slate", blurb: "No commitment — prepay and draw down." },
  business: { kind: "planBusiness", tone: "amber", blurb: "Lower per-minute rate with monthly autopay." },
  scale: { kind: "planScale", tone: "coral", blurb: "Our best self-serve rate, autopay." },
  enterprise: { kind: "planEnterprise", tone: "emerald", blurb: "Custom pricing at volume, dedicated support." },
};

const FAQS = [
  {
    q: "How do credits work?",
    a: "Credits are deducted per voice minute and telephony minute, drawn from your wallet. Business and Scale's monthly charge is itself a wallet top-up at a discounted rate.",
  },
  {
    q: "What happens when my plan's credits run out?",
    a: "Usage falls through to the pay-as-you-go rate against the same wallet until your next renewal, if overages are enabled (Manage subscription → Enable overages).",
  },
  {
    q: "Can I change plans later?",
    a: "Yes — upgrade or downgrade from the Billing page any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "What's included in phone number rental?",
    a: "A dedicated DID for inbound/outbound with KYC, billed monthly, same rate on every self-serve plan.",
  },
];

function money(rupees: number | null | undefined) {
  if (rupees == null) return "Custom";
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function VoiceAgentsPricingPage() {
  const { org, membership } = useWorkspace();
  const canManageBalance = membership?.role === "owner" || membership?.role === "admin";
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Plans & Pricing · Voice Agents · Kupe";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([
        api.getPlans(),
        org ? api.getWallet(org.id, { currency: "INR" }) : Promise.resolve(null),
      ]);
      setPlans(p);
      setWallet(w);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    void load();
  }, [load]);

  async function payAsYouGoTopup() {
    if (!org) return;
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      toast.error("Enter a positive amount in INR");
      return;
    }
    setBusyPlan("payg");
    try {
      const order = await api.createTopupOrder(org.id, Math.round(rupees * 100), "payg");
      const result = await openRazorpayCheckout({
        key: order.key_id,
        amount: order.amount_minor_units,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: "Kupe credits",
        description: `Add ₹${rupees.toLocaleString("en-IN")} in voice-agent credits`,
        theme: { color: "#111827" },
      });
      await api.verifyTopupPayment(org.id, {
        razorpay_order_id: result.razorpay_order_id!,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      toast.success(`Added ₹${rupees.toLocaleString("en-IN")} to your wallet`);
      setAddOpen(false);
      void load();
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusyPlan(null);
    }
  }

  async function subscribeToPlan(planCode: "business" | "scale") {
    if (!org) return;
    setBusyPlan(planCode);
    try {
      const sub = await api.createSubscription(org.id, planCode);
      if (!sub.razorpay_subscription_id || !sub.key_id) throw new Error("Could not start subscription");
      const result = await openRazorpayCheckout({
        key: sub.key_id,
        subscription_id: sub.razorpay_subscription_id,
        name: `Kupe ${planCode === "business" ? "Business" : "Scale"} plan`,
        description: "Monthly autopay — cancel any time from Billing",
        theme: { color: "#111827" },
      });
      // Razorpay confirms activation async via webhook — this just
      // acknowledges checkout completed; the webhook is the source of truth.
      void result;
      toast.success("Subscription set up — activating shortly");
      void load();
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error(e instanceof Error ? e.message : "Could not start subscription");
    } finally {
      setBusyPlan(null);
    }
  }

  function talkToSales() {
    window.location.href =
      "mailto:sales@kupe.in?subject=" + encodeURIComponent("Enterprise plan enquiry" + (org ? ` — ${org.name}` : ""));
  }

  return (
    <div className="voice-page voice-page-wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title">Plans & Pricing</h1>
        {wallet && !wallet.unmetered && (
          <Button variant="outline" className="rounded-full" size="sm" disabled>
            <ShoppingBag className="size-3.5" />
            ₹{wallet.balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })} balance
          </Button>
        )}
      </div>

      <div className="mt-8 text-center">
        <h2 className="text-display">Voice Agents pricing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pay at your scale. Get lower per-minute rates with a monthly plan.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(loading ? [] : plans).map((plan) => {
          const meta = PLAN_META[plan.code] ?? PLAN_META.payg;
          const isBusy = busyPlan === plan.code;
          return (
            <div
              key={plan.code}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-elevated group/nav"
            >
              <div className="flex h-20 items-center justify-center rounded-xl bg-muted/50">
                <AsciiIcon kind={meta.kind} tone={meta.tone} size="lg" title={plan.display_name} />
              </div>
              <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {plan.display_name}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {plan.monthly_commitment_rupees ? `${money(plan.monthly_commitment_rupees)} /month` : "Pay as you go"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{meta.blurb}</p>
              <Button
                className={cn("mt-4 w-full rounded-full")}
                variant={plan.code === "business" || plan.code === "scale" ? "secondary" : "default"}
                disabled={isBusy || !canManageBalance}
                onClick={() => {
                  if (plan.code === "payg") return setAddOpen(true);
                  if (plan.code === "enterprise") return talkToSales();
                  return subscribeToPlan(plan.code as "business" | "scale");
                }}
              >
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                {plan.code === "payg" ? "Add credits" : plan.code === "enterprise" ? "Talk to sales" : `Subscribe — ${money(plan.monthly_commitment_rupees)}/mo`}
              </Button>
              {!canManageBalance && (
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
                    <PlanFeature text={`Available on 1,00,000+ minutes/month`} show />
                    <PlanFeature text={`Renewals from ${money(plan.min_topup_rupees)}`} show={plan.min_topup_rupees != null} />
                  </>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <section className="mt-14 pb-10">
        <h2 className="text-lg font-semibold tracking-tight">Frequently Asked Questions</h2>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <li key={faq.q}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30"
                  onClick={() => setOpenFaq(open ? null : i)}
                >
                  {faq.q}
                  <span className="text-muted-foreground">{open ? "−" : "+"}</span>
                </button>
                {open ? <p className="px-4 pb-3 text-sm text-muted-foreground">{faq.a}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="credit-amount">Amount (₹)</Label>
            <Input
              id="credit-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busyPlan === "payg"}
            />
            <p className="text-xs text-muted-foreground">
              You'll be taken to Razorpay to complete payment. Credits are added to your wallet once payment is confirmed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setAddOpen(false)} disabled={busyPlan === "payg"}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={payAsYouGoTopup} disabled={busyPlan === "payg"}>
              {busyPlan === "payg" ? <Loader2 className="size-4 animate-spin" /> : null}
              Pay & add credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
