"use client";

import { useEffect, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  AsciiIcon,
  type AsciiIconKind,
  type AsciiIconTone,
} from "@/components/voice-agents/ascii-icons";
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

type Plan = {
  id: string;
  name: string;
  price: string;
  kind: AsciiIconKind;
  tone: AsciiIconTone;
  cta: string;
  ctaVariant: "default" | "secondary";
  disabled?: boolean;
  features: { text: string; note?: string; badge?: string }[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Pay as you go",
    kind: "planStarter",
    tone: "slate",
    cta: "Add credits",
    ctaVariant: "default",
    features: [
      { text: "₹4.50 / minute", note: "Voice calls" },
      { text: "₹0.40 / minute", note: "Telephony" },
      { text: "₹159.00 / month", note: "Phone number rental" },
      {
        text: "100 CPM, 50 channels",
        badge: "Launch offer",
        note: "Rate limits till 10 Aug",
      },
      { text: "20 CPM, 4 channels", note: "Rate limits after 10 Aug" },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "₹10,000 /month",
    kind: "planBusiness",
    tone: "amber",
    cta: "Coming soon",
    ctaVariant: "secondary",
    disabled: true,
    features: [
      { text: "₹4.00 / minute", note: "Voice calls" },
      { text: "₹0.40 / minute", note: "Telephony" },
      { text: "₹159.00 / month", note: "Phone number rental" },
      { text: "150 CPM, 30 channels", note: "Rate limits" },
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: "₹50,000 /month",
    kind: "planScale",
    tone: "coral",
    cta: "Coming soon",
    ctaVariant: "secondary",
    disabled: true,
    features: [
      { text: "₹3.50 / minute", note: "Voice calls" },
      { text: "₹0.40 / minute", note: "Telephony" },
      { text: "₹159.00 / month", note: "Phone number rental" },
      { text: "600 CPM, 120 channels", note: "Rate limits" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom pricing",
    kind: "planEnterprise",
    tone: "emerald",
    cta: "Talk to sales",
    ctaVariant: "default",
    features: [
      { text: "Workflows, WhatsApp campaigns, Custom tool authoring" },
      { text: "Custom concurrency & CPM" },
      { text: "Forward deployed engineering support" },
      { text: "Available on 3L+ minutes/month" },
    ],
  },
];

const FAQS = [
  {
    q: "How do credits work?",
    a: "Credits are deducted per voice minute and telephony minute. Unused credits roll month to month on Starter.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or talk to sales anytime — rate limits update on the next billing cycle.",
  },
  {
    q: "What’s included in phone number rental?",
    a: "A dedicated DID for inbound/outbound with KYC. ₹159/month per number on listed plans.",
  },
];

export default function VoiceAgentsPricingPage() {
  const [credits] = useState(2568);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Plans & Pricing · Voice Agents · Kupe";
  }, []);

  return (
    <div className="voice-page voice-page-wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title">Plans & Pricing</h1>
        <Button variant="outline" className="rounded-full" size="sm">
          <ShoppingBag className="size-3.5" />
          {credits.toLocaleString("en-IN")} Credits
        </Button>
      </div>

      <div className="mt-8 text-center">
        <h2 className="text-display">
          Voice Agents pricing
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pay at your scale. Get lower per-minute rates with a monthly plan.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-elevated group/nav"
          >
            <div className="flex h-20 items-center justify-center rounded-xl bg-muted/50">
              <AsciiIcon
                kind={plan.kind}
                tone={plan.tone}
                size="lg"
                title={plan.name}
              />
            </div>
            <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {plan.name}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {plan.price}
            </p>
            <Button
              className={cn("mt-4 w-full rounded-full")}
              variant={plan.ctaVariant}
              disabled={plan.disabled}
              onClick={() => {
                if (plan.id === "starter") {
                  setAddOpen(true);
                  return;
                }
                if (plan.id === "enterprise") {
                  toast.message("Talk to sales (demo)", {
                    description: "We’ll reach out with a custom quote.",
                  });
                  return;
                }
                toast.message(`${plan.name} is coming soon`);
              }}
            >
              {plan.cta}
            </Button>
            <ul className="mt-5 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f.text + (f.note ?? "")} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{f.text}</span>
                      {f.badge ? (
                        <Badge className="bg-emerald-100 font-normal text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                          {f.badge}
                        </Badge>
                      ) : null}
                    </div>
                    {f.note ? (
                      <p className="text-xs text-muted-foreground">{f.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="mt-14 pb-10">
        <h2 className="text-lg font-semibold tracking-tight">
          Frequently Asked Questions
        </h2>
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
                {open ? (
                  <p className="px-4 pb-3 text-sm text-muted-foreground">
                    {faq.a}
                  </p>
                ) : null}
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
            />
            <p className="text-xs text-muted-foreground">
              Credits are applied instantly on Starter (demo).
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                toast.message("Credits added (demo)", {
                  description: `₹${amount || "0"}`,
                });
                setAddOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
