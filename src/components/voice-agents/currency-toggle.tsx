"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DisplayCurrency } from "@/lib/api";

export const UI_DEFAULT_CURRENCY: DisplayCurrency = "INR";

const SYMBOL: Record<DisplayCurrency, string> = { USD: "$", INR: "₹" };

export function formatMoney(amount: number, currency: string) {
  const symbol = SYMBOL[currency as DisplayCurrency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function CurrencyToggle({
  value,
  onChange,
  disabled,
}: {
  value: DisplayCurrency;
  onChange: (next: DisplayCurrency) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {(["INR", "USD"] as const).map((code) => (
        <Button
          key={code}
          type="button"
          size="sm"
          variant={value === code ? "secondary" : "ghost"}
          className={cn("h-7 px-2.5", value === code && "shadow-none")}
          disabled={disabled}
          onClick={() => onChange(code)}
        >
          {code}
        </Button>
      ))}
    </div>
  );
}
