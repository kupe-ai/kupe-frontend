"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PlivoLogo } from "@/components/voice-agents/plivo-logo";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  PlivoComplianceApplication,
  PlivoCountry,
  PlivoNumberSearchResult,
  TelephonyProviderName,
} from "@/types";

type Provider = TelephonyProviderName;
type Step = "provider" | "twilio-form" | "plivo-country" | "plivo-numbers" | "plivo-kyc-form";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AddNumberDialog({
  open,
  onOpenChange,
  orgId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("provider");
  const [country, setCountry] = useState<PlivoCountry>("US");

  useEffect(() => {
    if (!open) setStep("provider");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Add a phone number</DialogTitle>

        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          {step !== "provider" && (
            <button
              type="button"
              onClick={() => setStep(step === "plivo-numbers" || step === "plivo-kyc-form" ? "plivo-country" : "provider")}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Back"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <h2 className="text-base font-semibold tracking-tight">
            {step === "provider" && "Add a phone number"}
            {step === "twilio-form" && "Connect Twilio"}
            {(step === "plivo-country" || step === "plivo-numbers") && "Buy a Plivo number"}
            {step === "plivo-kyc-form" && "Business verification"}
          </h2>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {step === "provider" && (
            <ProviderStep onPick={(p) => setStep(p === "twilio" ? "twilio-form" : "plivo-country")} />
          )}

          {step === "twilio-form" && (
            <TwilioForm
              orgId={orgId}
              onDone={() => {
                onDone();
                onOpenChange(false);
              }}
            />
          )}

          {step === "plivo-country" && (
            <CountryStep
              country={country}
              onPick={(c) => {
                setCountry(c);
                setStep("plivo-numbers");
              }}
            />
          )}

          {step === "plivo-numbers" && (
            <PlivoNumbersStep
              orgId={orgId}
              country={country}
              onStartKyc={() => setStep("plivo-kyc-form")}
              onPurchased={() => {
                onDone();
                onOpenChange(false);
              }}
            />
          )}

          {step === "plivo-kyc-form" && (
            <PlivoKycForm orgId={orgId} onSubmitted={() => setStep("plivo-numbers")} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------

function ProviderStep({ onPick }: { onPick: (provider: Provider) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose how you want to connect a number.</p>

      <button
        type="button"
        onClick={() => onPick("twilio")}
        className="pressable flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/40"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#F22F46] text-white font-bold text-sm">
          T
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Twilio</p>
          <p className="text-sm text-muted-foreground">Already have a Twilio number? Add your credentials directly.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick("plivo")}
        className="pressable flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/40"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
          <PlivoLogo className="h-4 w-auto text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Plivo</p>
          <p className="text-sm text-muted-foreground">Buy a new number, billed from your Kupe wallet.</p>
        </div>
      </button>

      <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 opacity-60">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
          E
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Exotel</p>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </div>
        <Badge variant="secondary">Soon</Badge>
      </div>
    </div>
  );
}

function CountryStep({ country, onPick }: { country: PlivoCountry; onPick: (c: PlivoCountry) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Which country is this number for?</p>
      <div className="grid grid-cols-2 gap-3">
        {(["US", "IN"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className={cn(
              "pressable rounded-xl border p-4 text-center hover:bg-muted/40",
              country === c ? "border-primary" : "border-border",
            )}
          >
            <p className="text-2xl">{c === "US" ? "🇺🇸" : "🇮🇳"}</p>
            <p className="mt-1 font-semibold">{c === "US" ? "United States" : "India"}</p>
            <p className="text-xs text-muted-foreground">{c === "US" ? "No verification needed" : "Business KYC required"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

function TwilioForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!accountSid || !authToken || !fromNumber) {
      toast.error("Account SID, Auth Token, and phone number are required");
      return;
    }
    setSaving(true);
    try {
      await api.createTelephonyAccount(orgId, {
        provider: "twilio",
        label: label || fromNumber,
        account_sid: accountSid,
        api_key: authToken,
        from_number: fromNumber,
        is_default: true,
      });
      toast.message("Twilio number connected");
      onDone();
    } catch {
      toast.error("Couldn't connect this Twilio account — check the credentials");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sales line" />
      </div>
      <div className="space-y-1.5">
        <Label>Account SID</Label>
        <Input value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxx" />
      </div>
      <div className="space-y-1.5">
        <Label>Auth token</Label>
        <Input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+14155551234" />
      </div>
      <Button className="w-full rounded-full" onClick={() => void save()} disabled={saving}>
        {saving ? "Connecting…" : "Connect number"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------

function PlivoNumbersStep({
  orgId,
  country,
  onStartKyc,
  onPurchased,
}: {
  orgId: string;
  country: PlivoCountry;
  onStartKyc: () => void;
  onPurchased: () => void;
}) {
  const [tab, setTab] = useState<"numbers" | "kyc">("numbers");
  const [loading, setLoading] = useState(true);
  const [numbers, setNumbers] = useState<PlivoNumberSearchResult[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<string | null>(null);
  const [pricing, setPricing] = useState({ monthly: 250, purchase: 250 });
  const [buying, setBuying] = useState<string | null>(null);
  const [complianceApp, setComplianceApp] = useState<PlivoComplianceApplication | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .searchPlivoNumbers(orgId, country)
      .then((res) => {
        if (cancelled) return;
        setNumbers(res.numbers);
        setComplianceStatus(res.compliance_status);
        setPricing({ monthly: res.monthly_rent_inr, purchase: res.purchase_price_inr });
      })
      .catch(() => toast.error("Couldn't load available numbers"))
      .finally(() => !cancelled && setLoading(false));
    if (country === "IN") {
      api.getPlivoComplianceStatus(orgId).then((a) => !cancelled && setComplianceApp(a)).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [orgId, country]);

  const canBuy = country === "US" || complianceStatus === "accepted";

  async function buy(number: string) {
    setBuying(number);
    try {
      await api.purchasePlivoNumber(orgId, { number, country_iso: country });
      toast.message(`${number} purchased — ₹${pricing.purchase} deducted from your wallet`);
      onPurchased();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  const body = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        ₹{pricing.purchase} one-time · ₹{pricing.monthly}/month rent, from your Kupe wallet.
      </p>

      {country === "IN" && !canBuy && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium">Business verification required</p>
          <p className="mt-0.5 text-muted-foreground">
            India numbers need KYC under your own business before they can be purchased.
          </p>
          <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={onStartKyc}>
            {complianceApp ? "Resume verification" : "Start verification"}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : numbers.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No numbers available right now.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {numbers.map((n) => (
            <li key={n.number} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="size-4 text-muted-foreground" />
                <span className="font-mono text-sm">{n.number}</span>
              </div>
              <Button
                size="sm"
                className="rounded-full"
                disabled={!canBuy || buying === n.number}
                onClick={() => void buy(n.number)}
              >
                {buying === n.number ? "Buying…" : "Buy"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (country !== "IN") return body;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="numbers">Numbers</TabsTrigger>
        <TabsTrigger value="kyc">
          KYC status
          {complianceApp && <StatusChip status={complianceApp.status} className="ml-1.5" />}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="numbers">{body}</TabsContent>
      <TabsContent value="kyc">
        <div className="space-y-3 py-2">
          {complianceApp ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{complianceApp.business_name}</p>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(complianceApp.created_at).toLocaleDateString()}</p>
                </div>
                <StatusChip status={complianceApp.status} />
              </div>
              {complianceApp.status === "rejected" && complianceApp.rejection_reason && (
                <p className="text-sm text-destructive">{complianceApp.rejection_reason}</p>
              )}
              {complianceApp.status !== "accepted" && (
                <Button variant="outline" size="sm" className="rounded-full" onClick={onStartKyc}>
                  Resubmit verification
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No verification submitted yet.</p>
              <Button size="sm" className="rounded-full" onClick={onStartKyc}>
                Start verification
              </Button>
            </>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------

function PlivoKycForm({ orgId, onSubmitted }: { orgId: string; onSubmitted: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gstin, setGstin] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [regCert, setRegCert] = useState<File | null>(null);
  const [gstCert, setGstCert] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    businessName && firstName && lastName && gstin && email && phone && address && city && region && postalCode && regCert && gstCert;

  async function submit() {
    if (!canSubmit || !regCert || !gstCert) {
      toast.error("Fill in every field and attach both documents");
      return;
    }
    setSubmitting(true);
    try {
      const [regBase64, gstBase64] = await Promise.all([fileToBase64(regCert), fileToBase64(gstCert)]);
      await api.submitPlivoCompliance(orgId, {
        end_user: {
          business_name: businessName,
          first_name: firstName,
          last_name: lastName,
          fiscal_identification_code: gstin,
          email,
          phone_number: phone,
          address_line1: address,
          city,
          region,
          postal_code: postalCode,
          country_iso: "IN",
        },
        registration_certificate_base64: regBase64,
        registration_certificate_filename: regCert.name,
        gst_certificate_base64: gstBase64,
        gst_certificate_filename: gstCert.name,
      });
      toast.message("Verification submitted");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit verification");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Documents are submitted to Plivo under your own business — Kupe never sees your compliance data beyond this form.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Business name" value={businessName} onChange={setBusinessName} full />
        <Field label="First name" value={firstName} onChange={setFirstName} />
        <Field label="Last name" value={lastName} onChange={setLastName} />
        <Field label="GSTIN" value={gstin} onChange={(v) => setGstin(v.toUpperCase())} full />
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Address" value={address} onChange={setAddress} full />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={region} onChange={setRegion} />
        <Field label="Postal code" value={postalCode} onChange={setPostalCode} full />
      </div>

      <div className="space-y-3">
        <FileField label="Registration certificate (MCA CoI / Udyam)" file={regCert} onChange={setRegCert} />
        <FileField label="GST certificate (Form GST REG-06)" file={gstCert} onChange={setGstCert} />
      </div>

      <Button className="w-full rounded-full" onClick={() => void submit()} disabled={!canSubmit || submitting}>
        {submitting ? "Submitting…" : "Submit for verification"}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", full && "col-span-2")}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <label className="pressable flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-sm hover:bg-muted/40">
        <span className={cn("truncate", !file && "text-muted-foreground")}>{file?.name ?? "Choose PDF"}</span>
        {file ? <Check className="size-4 shrink-0 text-emerald-600" /> : null}
        <input
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
