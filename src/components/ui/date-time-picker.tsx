"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange as DayPickerRange, Matcher } from "react-day-picker";
import { CalendarIcon, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  datePart,
  formatDate,
  formatDateTimeValue,
  timePart,
  toDateInput,
  toDateTimeLocal,
} from "@/lib/format";
import type { DateRange } from "@/lib/date-range-presets";

export type DateTimeGranularity = "date" | "datetime" | "time";

type DayPeriod = "AM" | "PM";

function parseLocalDate(value: string): Date | undefined {
  const day = datePart(value);
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function mergeDateAndTime(day: string, time: string, granularity: DateTimeGranularity): string {
  if (granularity === "time") return time.slice(0, 5);
  if (!day) return "";
  if (granularity === "date" || !time) return day;
  return `${day}T${time.slice(0, 5)}`;
}

function toPickerRange(range: DateRange): DayPickerRange | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    from: range.from ? parseLocalDate(range.from) : undefined,
    to: range.to ? parseLocalDate(range.to) : undefined,
  };
}

function formatRangeLabel(range: DateRange, placeholder: string): string {
  if (range.from && range.to) {
    return `${formatDate(range.from)} – ${formatDate(range.to)}`;
  }
  if (range.from) return `From ${formatDate(range.from)}`;
  if (range.to) return `Until ${formatDate(range.to)}`;
  return placeholder;
}

/** Split 24h `HH:mm` into 12-hour display parts. */
function from24h(hhmm: string): { hour: number; minute: number; period: DayPeriod } {
  const [hStr = "9", mStr = "0"] = (hhmm || "09:00").split(":");
  let h = Number.parseInt(hStr, 10);
  let m = Number.parseInt(mStr, 10);
  if (Number.isNaN(h)) h = 9;
  if (Number.isNaN(m)) m = 0;
  h = Math.max(0, Math.min(23, h));
  m = Math.max(0, Math.min(59, m));
  const period: DayPeriod = h >= 12 ? "PM" : "AM";
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return { hour, minute: m, period };
}

/** Build 24h `HH:mm` from 12-hour parts. */
function to24h(hour: number, minute: number, period: DayPeriod): string {
  const h12 = Math.max(1, Math.min(12, hour));
  const m = Math.max(0, Math.min(59, minute));
  let h24 = h12 % 12;
  if (period === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDisplayTime(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

/** Loose parse: "9", "9:0", "9:00", "09:00" → clamped 1–12 hour display. */
function parseLooseTime(text: string): { hour: number; minute: number } | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{1,2})(?::(\d{0,2}))?$/);
  if (!match) return null;
  let hour = Number.parseInt(match[1], 10);
  const minuteRaw = match[2];
  let minute =
    minuteRaw !== undefined && minuteRaw !== "" ? Number.parseInt(minuteRaw, 10) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  hour = Math.max(1, Math.min(12, hour));
  minute = Math.max(0, Math.min(59, minute));
  return { hour, minute };
}

function TimeField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const parsed = from24h(value || "09:00");
  const [text, setText] = useState(() => formatDisplayTime(parsed.hour, parsed.minute));
  const [period, setPeriod] = useState<DayPeriod>(parsed.period);

  useEffect(() => {
    const next = from24h(value || "09:00");
    setText(formatDisplayTime(next.hour, next.minute));
    setPeriod(next.period);
  }, [value]);

  function commit(hour: number, minute: number, nextPeriod: DayPeriod) {
    onChange(to24h(hour, minute, nextPeriod));
  }

  function applyText(raw: string, nextPeriod: DayPeriod = period) {
    const loose = parseLooseTime(raw);
    if (!loose) {
      const fallback = from24h(value || "09:00");
      setText(formatDisplayTime(fallback.hour, fallback.minute));
      return;
    }
    setText(formatDisplayTime(loose.hour, loose.minute));
    commit(loose.hour, loose.minute, nextPeriod);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <Clock className="size-4 shrink-0 text-muted-foreground" />
      <Input
        type="text"
        inputMode="numeric"
        placeholder="9:00"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => applyText(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyText(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Time"
        className="h-8 w-[4.75rem] bg-background tabular-nums"
      />
      <ToggleGroup
        type="single"
        value={period}
        disabled={disabled}
        spacing={0}
        variant="outline"
        size="sm"
        onValueChange={(v) => {
          if (v !== "AM" && v !== "PM") return;
          const loose = parseLooseTime(text) ?? from24h(value || "09:00");
          setPeriod(v);
          setText(formatDisplayTime(loose.hour, loose.minute));
          commit(loose.hour, loose.minute, v);
        }}
        className="shrink-0"
      >
        <ToggleGroupItem value="AM" aria-label="AM" className="px-2.5">
          AM
        </ToggleGroupItem>
        <ToggleGroupItem value="PM" aria-label="PM" className="px-2.5">
          PM
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

/**
 * Canonical date / time / range picker — clean shadcn bubble calendar.
 * granularity: date | datetime | time · mode: single | range
 */
export function DateTimePicker({
  mode = "single",
  granularity = "date",
  value = "",
  onChange,
  rangeValue,
  onRangeChange,
  placeholder,
  disabled,
  minDate,
  maxDate,
  allowClear = false,
  className,
  numberOfMonths,
}: {
  mode?: "single" | "range";
  granularity?: DateTimeGranularity;
  value?: string;
  onChange?: (v: string) => void;
  rangeValue?: DateRange;
  onRangeChange?: (v: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  allowClear?: boolean;
  className?: string;
  numberOfMonths?: number;
}) {
  const [open, setOpen] = useState(false);
  const isRange = mode === "range";
  const showCalendar = granularity !== "time";
  const showTime = !isRange && (granularity === "datetime" || granularity === "time");
  // One month on small screens so the popover stays inside the viewport / dialogs.
  const [months, setMonths] = useState(1);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () =>
      setMonths(numberOfMonths ?? (isRange && mq.matches ? 2 : 1));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [isRange, numberOfMonths]);

  const selected = useMemo(() => parseLocalDate(value), [value]);
  const selectedTime =
    granularity === "time"
      ? value.length >= 4
        ? value.slice(0, 5)
        : "09:00"
      : timePart(value) || "09:00";
  const range = rangeValue ?? { from: "", to: "" };
  const rangeSelected = useMemo(() => toPickerRange(range), [range]);

  const matchers: Matcher[] = [];
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });
  const disabledDays = matchers.length ? matchers : undefined;

  const hasValue = isRange ? Boolean(range.from || range.to) : Boolean(value);
  const label = isRange
    ? formatRangeLabel(range, placeholder ?? "Pick a date range")
    : value
      ? formatDateTimeValue(value)
      : (placeholder ?? (granularity === "time" ? "Pick a time" : "Pick a date"));

  function commitSingle(day: string, time: string) {
    onChange?.(mergeDateAndTime(day, time, granularity));
  }

  function clear() {
    if (isRange) onRangeChange?.({ from: "", to: "" });
    else onChange?.("");
  }

  function setToday() {
    const now = new Date();
    if (isRange) {
      const today = toDateInput(now);
      onRangeChange?.({ from: today, to: today });
      setOpen(false);
      return;
    }
    if (granularity === "time") {
      onChange?.(toDateTimeLocal(now).slice(11, 16));
      setOpen(false);
      return;
    }
    const today = toDateInput(now);
    const time = granularity === "datetime" ? toDateTimeLocal(now).slice(11, 16) : selectedTime;
    commitSingle(today, time);
    if (granularity === "date") setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full min-w-0 justify-start rounded-lg font-normal",
            !hasValue && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex w-full min-w-0 items-center gap-1.5">
            {granularity === "time" ? (
              <Clock className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {allowClear && hasValue && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto max-w-[min(100vw-1.5rem,22rem)] border-border bg-popover p-0 shadow-elevated",
          isRange && "sm:max-w-[min(100vw-1.5rem,40rem)]",
        )}
        align="start"
        collisionPadding={12}
      >
        {showCalendar && isRange && (
          <Calendar
            mode="range"
            captionLayout="label"
            numberOfMonths={months}
            className="w-full max-w-full [--cell-size:--spacing(8)] sm:[--cell-size:--spacing(7)]"
            selected={rangeSelected}
            defaultMonth={rangeSelected?.from ?? rangeSelected?.to}
            onSelect={(r) =>
              onRangeChange?.({
                from: r?.from ? toDateInput(r.from) : "",
                to: r?.to ? toDateInput(r.to) : "",
              })
            }
            disabled={disabledDays}
            autoFocus
          />
        )}
        {showCalendar && !isRange && (
          <Calendar
            mode="single"
            captionLayout="label"
            className="w-full max-w-full [--cell-size:--spacing(8)] sm:[--cell-size:--spacing(7)]"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (!d) {
                onChange?.("");
                return;
              }
              commitSingle(toDateInput(d), selectedTime);
              if (granularity === "date") setOpen(false);
            }}
            disabled={disabledDays}
            autoFocus
          />
        )}

        {showTime && (
          <div className={cn(showCalendar && "border-t border-border")}>
            <TimeField
              value={selectedTime}
              onChange={(t) => {
                if (granularity === "time") {
                  onChange?.(t);
                  return;
                }
                const day = datePart(value) || toDateInput(new Date());
                commitSingle(day, t);
              }}
              disabled={disabled}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 font-normal text-muted-foreground"
            disabled={!hasValue}
            onClick={(e) => {
              e.stopPropagation();
              clear();
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 font-normal text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setToday();
              }}
            >
              {granularity === "time" ? "Now" : "Today"}
            </Button>
            {showTime && (
              <Button
                type="button"
                size="sm"
                className="h-8 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
