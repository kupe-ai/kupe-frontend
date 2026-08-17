"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useWorkspace } from "@/context/workspace-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BillingPlanCards } from "@/components/voice-agents/billing-plan-cards";
import type { Wallet } from "@/types";

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

export default function VoiceAgentsPricingPage() {
  const { org, membership } = useWorkspace();
  const canManageBalance = membership?.role === "owner" || membership?.role === "admin";
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Plans & Pricing · Voice Agents · Kupe";
  }, []);

  useEffect(() => {
    if (!org) return;
    void api.getWallet(org.id, { currency: "INR" }).then(setWallet).catch(() => {});
  }, [org]);

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

      <div className="mt-10">
        <BillingPlanCards orgId={org?.id} canManage={canManageBalance} onChanged={() => {
          if (org) void api.getWallet(org.id, { currency: "INR" }).then(setWallet).catch(() => {});
        }} />
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
    </div>
  );
}
