"use client";

import { DateTimePicker } from "@/components/ui/date-time-picker";

/** Single-date picker — thin wrapper over DateTimePicker. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  minDate,
  maxDate,
  allowClear,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  allowClear?: boolean;
  className?: string;
}) {
  return (
    <DateTimePicker
      mode="single"
      granularity="date"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      allowClear={allowClear}
      className={className}
    />
  );
}
