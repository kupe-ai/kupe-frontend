import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DAY_LABELS,
  availabilitySummary,
  isWithinHours,
  type InboundAvailability,
} from "@/lib/api/voice/inbound";

const PREFERRED_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

function timezoneOptions() {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          "timeZone",
        )
      : PREFERRED_TIMEZONES;
  const seen = new Set<string>();
  return [...PREFERRED_TIMEZONES, ...supported]
    .filter((tz) => {
      if (seen.has(tz)) return false;
      seen.add(tz);
      return true;
    })
    .map((tz) => ({ value: tz, label: tz.replaceAll("_", " ") }));
}

const TZ_OPTIONS = timezoneOptions();

export function AvailabilityFields({
  value,
  onChange,
}: {
  value: InboundAvailability;
  onChange: (next: InboundAvailability) => void;
}) {
  const mode: "always" | "custom" = value.always ? "always" : "custom";
  const overnight = !value.always && value.start > value.end;
  const open = isWithinHours(value);

  function patch(p: Partial<InboundAvailability>) {
    onChange({ ...value, ...p });
  }

  function toggleDay(dow: number) {
    const active = value.days_of_week.includes(dow);
    patch({
      days_of_week: active
        ? value.days_of_week.filter((d) => d !== dow)
        : [...value.days_of_week, dow].sort((a, b) => a - b),
    });
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium text-foreground">Availability</p>
        <p className="mt-1 text-muted-foreground">
          When this number answers. Outside hours the call is not connected.
        </p>
      </div>

      <div className="inline-flex rounded-full bg-muted/70 p-1">
        {(
          [
            ["always", "Always available"],
            ["custom", "Custom hours"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => patch({ always: id === "always" })}
            className={cn(
              "pressable rounded-full px-3.5 py-1.5 text-sm",
              mode === id
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Timezone</Label>
        <SearchableSelect
          value={value.timezone}
          onChange={(timezone) => patch({ timezone })}
          options={TZ_OPTIONS}
          placeholder="Select timezone"
          searchPlaceholder="Search timezones"
          className="w-full max-w-none"
        />
      </div>

      {mode === "custom" ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="space-y-1.5">
            <Label>On these days</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, dow) => {
                const active = value.days_of_week.includes(dow);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(dow)}
                    className={cn(
                      "pressable rounded-full border px-3 py-1 text-xs font-medium",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Opens</Label>
              <DateTimePicker
                granularity="time"
                value={value.start}
                onChange={(v) => patch({ start: v || "09:00" })}
                placeholder="9:00 AM"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Closes</Label>
              <DateTimePicker
                granularity="time"
                value={value.end}
                onChange={(v) => patch({ end: v || "18:00" })}
                placeholder="6:00 PM"
              />
            </div>
          </div>
          {overnight ? (
            <p className="text-xs text-muted-foreground">Overnight window — closes the next morning.</p>
          ) : null}

          <div className="space-y-1.5">
            <Label>
              After-hours message <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={value.after_hours_message}
              onChange={(e) => patch({ after_hours_message: e.target.value })}
              placeholder="Sorry, we’re closed. Please call back during business hours."
              rows={2}
            />
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-muted-foreground">
          Answers every day, any time, in {value.timezone.replaceAll("_", " ")}.
        </p>
      )}

      <div className="rounded-xl border border-border px-4 py-3">
        <p className="font-medium text-foreground">{availabilitySummary(value)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{open ? "Open now" : "Currently outside hours"}</p>
      </div>
    </div>
  );
}
