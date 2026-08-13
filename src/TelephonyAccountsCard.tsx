import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TelephonyAccount, TelephonyProviderName } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROVIDERS: TelephonyProviderName[] = ["twilio", "plivo", "exotel"];

type Props = {
  orgId: string;
  isAdmin: boolean;
};

export function TelephonyAccountsCard({ orgId, isAdmin }: Props) {
  const [accounts, setAccounts] = useState<TelephonyAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<TelephonyProviderName>("twilio");
  const [label, setLabel] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [exotelSubdomain, setExotelSubdomain] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState(false);

  function load() {
    api
      .listTelephonyAccounts(orgId)
      .then(setAccounts)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load accounts"));
  }

  useEffect(() => {
    load();
  }, [orgId]);

  async function create() {
    if (!accountSid.trim() || !apiKey.trim() || !fromNumber.trim()) {
      setError("Account SID, API key/token, and from number are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createTelephonyAccount(orgId, {
        provider,
        label: label.trim(),
        account_sid: accountSid.trim(),
        api_key: apiKey.trim(),
        from_number: fromNumber.trim(),
        exotel_subdomain: provider === "exotel" ? exotelSubdomain.trim() || null : null,
        is_default: isDefault,
      });
      setLabel("");
      setAccountSid("");
      setApiKey("");
      setFromNumber("");
      setExotelSubdomain("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteTelephonyAccount(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telephony accounts</CardTitle>
        <CardDescription>Provider credentials for outbound batch calling, stored in the database.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ul className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {a.label || a.provider}
                  {a.is_default ? " · default" : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.provider} · {a.from_number} · {a.account_sid}
                </div>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void remove(a.id)}>
                  Delete
                </Button>
              )}
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No telephony accounts yet.</p>}
        </ul>

        {isAdmin && (
          <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as TelephonyProviderName)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-label">Label</Label>
              <Input id="tel-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Production Twilio" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-sid">Account SID / API key id</Label>
              <Input id="tel-sid" value={accountSid} onChange={(e) => setAccountSid(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-key">Auth token / API secret</Label>
              <Input id="tel-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-from">From number</Label>
              <Input id="tel-from" value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+15551212" />
            </div>
            {provider === "exotel" && (
              <div className="space-y-2">
                <Label htmlFor="tel-exo">Exotel API host</Label>
                <Input
                  id="tel-exo"
                  value={exotelSubdomain}
                  onChange={(e) => setExotelSubdomain(e.target.value)}
                  placeholder="api.in.exotel.com"
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={isDefault} onCheckedChange={(c) => setIsDefault(c === true)} />
              Default for this provider
            </label>
            <div className="sm:col-span-2">
              <Button className="cursor-pointer" disabled={busy} onClick={() => void create()}>
                Add account
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
