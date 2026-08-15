"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listKycApplications,
  listPhoneNumbers,
  submitKyc,
  type VoiceKycApplication,
  type VoicePhoneNumber,
} from "@/lib/api/voice/telephony";

const STATUS_LABEL: Record<VoiceKycApplication["status"], string> = {
  draft: "KYC not started",
  submitted: "KYC submitted",
  under_review: "KYC in review",
  approved: "KYC approved",
  rejected: "KYC rejected",
};

export default function VoiceAgentsPhoneNumbersPage() {
  const navigate = useNavigate();
  const [kycOpen, setKycOpen] = useState(false);
  const [applications, setApplications] = useState<VoiceKycApplication[]>([]);
  const [numbers, setNumbers] = useState<VoicePhoneNumber[]>([]);

  const refresh = useCallback(() => {
    listKycApplications().then(setApplications).catch(() => setApplications([]));
    listPhoneNumbers().then(setNumbers).catch(() => setNumbers([]));
  }, []);

  useEffect(() => {
    document.title = "Phone numbers · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  const latestKyc = applications[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
        Take your agent live.
      </h1>

      {numbers.length > 0 && (
        <div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Number</span>
            <span>Provider</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {numbers.map((n) => (
              <li key={n.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
                <span className="font-mono text-sm">{n.e164_number}</span>
                <span className="text-sm capitalize text-muted-foreground">{n.provider}</span>
                <Badge className="font-normal capitalize">{n.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mx-auto mt-10 max-w-lg">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <AsciiIcon kind="folder" tone="coral" size="lg" title="Rent from Kupe" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Rent from Kupe
            </h2>
            <Badge className="bg-emerald-100 font-normal text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {latestKyc ? STATUS_LABEL[latestKyc.status] : "Not started"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {latestKyc
              ? "Pick up where you left off and finish verification to buy numbers."
              : "Start verification to rent your first number."}
          </p>
          <ul className="mt-5 space-y-2.5 text-sm">
            {[
              "Add or release numbers anytime.",
              "Buy numbers directly, billed through Kupe credits.",
              "Set up fully managed telephony infra in 2 minutes.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 text-sm text-sky-600 hover:underline dark:text-sky-400"
            onClick={() => navigate("/voice-agents/pricing")}
          >
            Usage-based pricing · View details
          </button>
          <Button
            className="mt-6 w-full rounded-full"
            onClick={() => setKycOpen(true)}
            disabled={latestKyc?.status === "approved" || latestKyc?.status === "under_review" || latestKyc?.status === "submitted"}
          >
            {latestKyc ? "Resume KYC" : "Start KYC"}
            <ChevronRight className="size-4" />
          </Button>
          <p className="mt-4 text-right text-xs text-muted-foreground">
            Powered by Kupe Telephony
          </p>
        </div>
      </div>

      <KycWizard
        open={kycOpen}
        onOpenChange={setKycOpen}
        onSubmitted={() => {
          refresh();
        }}
      />
    </div>
  );
}

type KycKind = "individual" | "company";

function KycWizard({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [step, setStep] = useState<"type" | "verify" | "done">("type");
  const [kind, setKind] = useState<KycKind | null>(null);
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [companyPan, setCompanyPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("type");
      setKind(null);
      setPanNumber("");
      setAadhaarLast4("");
      setCompanyPan("");
      setGstin("");
    }
  }, [open]);

  async function submit() {
    if (!kind) return;
    setSubmitting(true);
    try {
      await submitKyc({
        kind,
        pan_number: kind === "individual" ? panNumber : undefined,
        aadhaar_last4: kind === "individual" ? aadhaarLast4 : undefined,
        company_pan: kind === "company" ? companyPan : undefined,
        gstin: kind === "company" ? gstin : undefined,
      });
      setStep("done");
      onSubmitted();
    } catch {
      toast.error("Couldn't submit KYC application");
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { id: "type", n: 1, label: "Type" },
    { id: "verify", n: 2, label: "Verify" },
    { id: "done", n: 3, label: "Done" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">KYC verification</DialogTitle>
        <div className="flex items-center gap-2 bg-foreground px-4 py-3 text-background">
          <AsciiIcon kind="phone" tone="coral" size="sm" className="!text-primary" />
          <span className="text-sm font-semibold tracking-tight">kupe</span>
        </div>

        <div className="px-5 pt-5 pb-2">
          <div className="flex items-center justify-center gap-2 text-xs">
            {steps.map((s, i, arr) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                      step === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.n}
                  </span>
                  <span className={cn("text-[11px]", step === s.id ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                </div>
                {i < arr.length - 1 ? <div className="mb-4 h-px w-10 bg-border sm:w-14" /> : null}
              </div>
            ))}
          </div>

          {step === "type" && (
            <>
              <h2 className="mt-6 text-xl font-semibold tracking-tight">Select Verification Type</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the type that applies to you to begin KYC verification.
              </p>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    setKind("individual");
                    setStep("verify");
                  }}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <AsciiIcon kind="person" tone="coral" size="sm" className="!text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Individual</p>
                    <p className="text-sm text-muted-foreground">For personal / proprietorship KYC</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ReqChip>PAN Card</ReqChip>
                      <ReqChip>Aadhaar</ReqChip>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    setKind("company");
                    setStep("verify");
                  }}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                    <AsciiIcon kind="building" tone="slate" size="sm" className="!text-background" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Company / Business</p>
                    <p className="text-sm text-muted-foreground">For registered companies, LLPs, firms</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ReqChip>Company PAN</ReqChip>
                      <ReqChip>GST Registration Number</ReqChip>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            </>
          )}

          {step === "verify" && kind && (
            <>
              <h2 className="mt-6 text-xl font-semibold tracking-tight">
                {kind === "individual" ? "Individual details" : "Company details"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Submitted for admin review — no live verification is performed automatically.
              </p>
              <div className="mt-5 space-y-4">
                {kind === "individual" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>PAN number</Label>
                      <Input value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Aadhaar (last 4 digits)</Label>
                      <Input value={aadhaarLast4} onChange={(e) => setAadhaarLast4(e.target.value)} maxLength={4} placeholder="1234" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Company PAN</Label>
                      <Input value={companyPan} onChange={(e) => setCompanyPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>GSTIN</Label>
                      <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setStep("type")}>
                  Back
                </Button>
                <Button type="button" className="rounded-full" onClick={() => void submit()} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit for review"}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="size-6" />
              </div>
              <h2 className="text-lg font-semibold">Submitted for review</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                An admin will review your documents and approve number rental once verified.
              </p>
              <Button type="button" className="mt-2 rounded-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReqChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800 dark:bg-orange-950/40 dark:text-orange-100">
      <Check className="size-3" />
      {children}
    </span>
  );
}
