"use client";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { DateRange } from "@/lib/date-range-presets";

/** Date range picker — thin wrapper over DateTimePicker. */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  disabled,
  allowClear,
  className,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}) {
  return (
    <DateTimePicker
      mode="range"
      granularity="date"
      rangeValue={value}
      onRangeChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      className={className}
    />
  );
}
