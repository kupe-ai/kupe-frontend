"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { listTimezoneValues, timezoneFlag, timezoneLabel } from "@/lib/timezone-options";

function buildOptions(): SearchableOption[] {
  return listTimezoneValues().map((tz) => ({
    value: tz,
    label: timezoneLabel(tz),
    keywords: tz,
    icon: <span className="text-base leading-none">{timezoneFlag(tz)}</span>,
  }));
}

export function TimezoneSelect({
  value,
  onChange,
  label = "Timezone",
  description,
  placeholder = "Select timezone",
  className,
}: {
  value: string;
  onChange: (timezone: string) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  className?: string;
}) {
  const options = useMemo(() => buildOptions(), []);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchPlaceholder="Search timezones"
        className={className ?? "w-full max-w-none"}
      />
    </div>
  );
}
