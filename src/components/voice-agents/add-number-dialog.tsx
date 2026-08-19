"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusChip, formatStatusLabel } from "@/components/ui/status-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { flagForNumber } from "@/lib/country-flag";
import type { PlivoComplianceApplication, PlivoCountry, PlivoNumberSearchResult } from "@/types";
import { API_BASE_URL } from "@/lib/voice-deploy-data";

type ProviderPick = "twilio" | "plivo";
type Step =
  | "provider"
  | "twilio-form"
  | "plivo-method"
  | "plivo-byok"
  | "plivo-country"
  | "plivo-numbers"
  | "plivo-kyc-form";
type IndiaStd = "80" | "22";

const INDIA_STD: { value: IndiaStd; label: string; city: string }[] = [
  { value: "80", label: "080", city: "Bengaluru" },
  { value: "22", label: "022", city: "Mumbai" },
];

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

function kycStatusLabel(status: string): string {
  if (status === "submitted") return "Under Review";
  if (status === "accepted") return "Approved";
  return formatStatusLabel(status);
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
      <DialogContent
        showCloseButton
        className="flex h-[min(85vh,640px)] max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Add a phone number</DialogTitle>

        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4">
          {step !== "provider" && (
            <button
              type="button"
              onClick={() =>
                setStep(
                  step === "plivo-numbers" || step === "plivo-kyc-form"
                    ? "plivo-country"
                    : step === "plivo-country" || step === "plivo-byok"
                      ? "plivo-method"
                      : "provider",
                )
              }
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Back"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <h2 className="text-base font-semibold tracking-tight">
            {step === "provider" && "Add a phone number"}
            {step === "twilio-form" && "Connect Twilio"}
            {step === "plivo-method" && "Plivo"}
            {step === "plivo-byok" && "Connect Plivo"}
            {(step === "plivo-country" || step === "plivo-numbers") && "Buy a Plivo number"}
            {step === "plivo-kyc-form" && "Business verification"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {step === "provider" && (
            <ProviderStep onPick={(p) => setStep(p === "twilio" ? "twilio-form" : "plivo-method")} />
          )}

          {step === "plivo-method" && (
            <PlivoMethodStep
              onBuy={() => setStep("plivo-country")}
              onByok={() => setStep("plivo-byok")}
            />
          )}

          {step === "twilio-form" && (
            <ByokForm
              orgId={orgId}
              provider="twilio"
              onDone={() => {
                onDone();
                onOpenChange(false);
              }}
            />
          )}

          {step === "plivo-byok" && (
            <ByokForm
              orgId={orgId}
              provider="plivo"
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

function ProviderMark({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-border">
      <img src={src} alt={alt} className="size-5 object-contain" />
    </span>
  );
}

function ProviderStep({ onPick }: { onPick: (pick: ProviderPick) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose how you want to connect a number.</p>

      <button
        type="button"
        onClick={() => onPick("twilio")}
        className="pressable flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/40"
      >
        <ProviderMark src="/providers/twilio.png" alt="Twilio" />
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
        <ProviderMark src="/providers/plivo.png" alt="Plivo" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Plivo</p>
          <p className="text-sm text-muted-foreground">Buy a new number or connect one you already own.</p>
        </div>
      </button>

      <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 opacity-60">
        <ProviderMark src="/providers/exotel.png" alt="Exotel" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Exotel</p>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </div>
        <Badge variant="secondary">Soon</Badge>
      </div>
    </div>
  );
}

function PlivoMethodStep({ onBuy, onByok }: { onBuy: () => void; onByok: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">How do you want to add this Plivo number?</p>

      <button
        type="button"
        onClick={onBuy}
        className="pressable flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/40"
      >
        <ProviderMark src="/providers/plivo.png" alt="Plivo" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Buy a number</p>
          <p className="text-sm text-muted-foreground">Billed from your Kupe wallet.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={onByok}
        className="pressable flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/40"
      >
        <ProviderMark src="/providers/plivo.png" alt="Plivo" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Your Plivo number</p>
          <p className="text-sm text-muted-foreground">
            Already have a Plivo number? Connect it with your Auth ID and token.
          </p>
        </div>
      </button>
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

function ByokForm({
  orgId,
  provider,
  onDone,
}: {
  orgId: string;
  provider: "twilio" | "plivo";
  onDone: () => void;
}) {
  const isPlivo = provider === "plivo";
  const [label, setLabel] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!accountSid || !authToken || !fromNumber) {
      toast.error(
        isPlivo
          ? "Auth ID, Auth Token, and phone number are required"
          : "Account SID, Auth Token, and phone number are required",
      );
      return;
    }
    setSaving(true);
    try {
      await api.createTelephonyAccount(orgId, {
        provider,
        label: label || fromNumber,
        account_sid: accountSid,
        api_key: authToken,
        from_number: fromNumber,
        is_default: true,
      });
      toast.message(isPlivo ? "Plivo number connected" : "Twilio number connected");
      onDone();
    } catch {
      toast.error(
        isPlivo
          ? "Couldn't connect this Plivo account — check the credentials"
          : "Couldn't connect this Twilio account — check the credentials",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isPlivo
          ? "Uses your own Plivo account. Calls bill to Plivo, not the Kupe wallet. Set this number’s Answer URL to POST " +
            `${API_BASE_URL}/v1/telephony/plivo/inbound` +
            " and Hangup URL to POST " +
            `${API_BASE_URL}/v1/telephony/plivo/inbound/status` +
            "."
          : "Uses your own Twilio account."}
      </p>
      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sales line" />
      </div>
      <div className="space-y-1.5">
        <Label>{isPlivo ? "Auth ID" : "Account SID"}</Label>
        <Input
          value={accountSid}
          onChange={(e) => setAccountSid(e.target.value)}
          placeholder={isPlivo ? "MAxxxxxxxxxxxxxxxx" : "ACxxxxxxxxxxxxxxxx"}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Auth token</Label>
        <Input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input
          value={fromNumber}
          onChange={(e) => setFromNumber(e.target.value)}
          placeholder={isPlivo ? "+918012345678" : "+14155551234"}
        />
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
  const [stdPrefix, setStdPrefix] = useState<IndiaStd>("80");
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
      .searchPlivoNumbers(orgId, country, country === "IN" ? stdPrefix : undefined)
      .then((res) => {
        if (cancelled) return;
        setNumbers(res.numbers);
        setComplianceStatus(res.compliance_status);
        setPricing({ monthly: res.monthly_rent_inr, purchase: res.purchase_price_inr });
      })
      .catch(() => toast.error("Couldn't load available numbers"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orgId, country, stdPrefix]);

  useEffect(() => {
    if (country !== "IN") return;
    let cancelled = false;
    api
      .refreshPlivoCompliance(orgId)
      .then((a) => {
        if (cancelled) return;
        setComplianceApp(a);
        if (a) setComplianceStatus(a.status);
      })
      .catch(() => {
        api.getPlivoComplianceStatus(orgId).then((a) => {
          if (cancelled) return;
          setComplianceApp(a);
          if (a) setComplianceStatus(a.status);
        }).catch(() => {});
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, country]);

  const kycStatus = complianceApp?.status ?? complianceStatus;
  const reviewing = kycStatus === "submitted" || kycStatus === "draft";
  const canBuy = country === "US" || kycStatus === "accepted";
  const stdMeta = INDIA_STD.find((s) => s.value === stdPrefix);

  useEffect(() => {
    if (country !== "IN" || !reviewing) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const app = await api.refreshPlivoCompliance(orgId);
        if (cancelled) return;
        setComplianceApp(app);
        if (app) {
          setComplianceStatus((prev) => {
            if (prev !== "accepted" && app.status === "accepted") {
              toast.message("Business verification approved — you can buy India numbers now");
            }
            return app.status;
          });
        }
      } catch {
        /* keep polling; webhook/beat will catch it */
      }
    };
    const id = window.setInterval(() => void tick(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orgId, country, reviewing]);

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
      {country === "IN" && (
        <div className="flex gap-1 rounded-lg bg-muted p-[3px]" role="tablist" aria-label="STD code">
          {INDIA_STD.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={stdPrefix === opt.value}
              onClick={() => setStdPrefix(opt.value)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                stdPrefix === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label} · {opt.city}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        ₹{pricing.purchase} one-time · ₹{pricing.monthly}/month rent, from your Kupe wallet.
      </p>

      {country === "IN" && !canBuy && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          {reviewing ? (
            <>
              <p className="font-medium">Verification under review</p>
              <p className="mt-0.5 text-muted-foreground">
                Plivo typically approves this in a few minutes. Buy unlocks automatically once they accept it.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Business verification required</p>
              <p className="mt-0.5 text-muted-foreground">
                India numbers need KYC under your own business before they can be purchased.
              </p>
              <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={onStartKyc}>
                {complianceApp ? "Resume verification" : "Start verification"}
              </Button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[22rem] flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : numbers.length === 0 ? (
        <p className="flex min-h-[22rem] flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          {country === "IN"
            ? `No ${stdMeta?.label} ${stdMeta?.city} numbers available right now.`
            : "No numbers available right now."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {numbers.map((n) => (
            <li key={n.number} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none" aria-hidden>
                  {flagForNumber(n.number, n.country_iso || country)}
                </span>
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
          {complianceApp && (
            <StatusChip status={complianceApp.status} className="ml-1.5">
              {kycStatusLabel(complianceApp.status)}
            </StatusChip>
          )}
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
                  <p className="text-xs text-muted-foreground">
                    {complianceApp.status === "submitted" ? "Under review since" : "Submitted"}{" "}
                    {new Date(complianceApp.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip status={complianceApp.status}>{kycStatusLabel(complianceApp.status)}</StatusChip>
              </div>
              {complianceApp.status === "submitted" && (
                <p className="text-sm text-muted-foreground">
                  Plivo is reviewing this. Status updates automatically — usually within a few minutes.
                </p>
              )}
              {complianceApp.status === "accepted" && (
                <p className="text-sm text-muted-foreground">Approved — you can buy India numbers now.</p>
              )}
              {complianceApp.status === "rejected" && complianceApp.rejection_reason && (
                <p className="text-sm text-destructive">{complianceApp.rejection_reason}</p>
              )}
              {complianceApp.status === "rejected" && (
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
        Plivo reviews the Certificate of Incorporation (or Udyam) and GST REG-06 under your business.
        Use the CIN from the incorporation certificate as the registration number, not the GSTIN.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Business name" value={businessName} onChange={setBusinessName} full />
        <Field label="First name" value={firstName} onChange={setFirstName} />
        <Field label="Last name" value={lastName} onChange={setLastName} />
        <Field label="CIN / Udyam number" value={gstin} onChange={(v) => setGstin(v.toUpperCase())} full />
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
        <span className={cn("truncate", !file && "text-muted-foreground")}>{file?.name ?? "PDF, JPEG, or PNG"}</span>
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
