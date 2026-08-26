import type { ReactNode } from "react";
import { PhoneIncoming, PhoneOutgoing, Globe } from "lucide-react";
import type { AnalysisField } from "@/types";
import type { CallDatabaseRow } from "@/lib/api/voice/databases";
import { cn } from "@/lib/utils";

const ENUM_TONES = [
  "bg-blue-500/12 text-blue-800 dark:text-blue-200",
  "bg-violet-500/12 text-violet-800 dark:text-violet-200",
  "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
  "bg-amber-500/12 text-amber-900 dark:text-amber-200",
  "bg-rose-500/12 text-rose-800 dark:text-rose-200",
  "bg-sky-500/12 text-sky-800 dark:text-sky-200",
  "bg-orange-500/12 text-orange-800 dark:text-orange-200",
  "bg-pink-500/12 text-pink-800 dark:text-pink-200",
  "bg-teal-500/12 text-teal-800 dark:text-teal-200",
] as const;

export const DIRECTION_META: Record<
  string,
  { label: string; className: string; Icon: typeof PhoneIncoming }
> = {
  inbound: {
    label: "Incoming",
    className: "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    Icon: PhoneIncoming,
  },
  incoming: {
    label: "Incoming",
    className: "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    Icon: PhoneIncoming,
  },
  outbound: {
    label: "Outbound",
    className: "bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    Icon: PhoneOutgoing,
  },
  web: {
    label: "Web",
    className: "bg-muted text-foreground/80",
    Icon: Globe,
  },
};

function hashTone(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return ENUM_TONES[h % ENUM_TONES.length];
}

export function NotionChip({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium leading-5",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function rawValue(row: CallDatabaseRow, key: string): unknown {
  if (key === "who_called") return row.who_called;
  if (key === "direction") return row.direction;
  if (key === "started_at") return row.started_at;
  if (key === "duration_seconds") return row.duration_seconds;
  return row.values?.[key];
}

function asBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["yes", "true", "y"].includes(s)) return true;
    if (["no", "false", "n"].includes(s)) return false;
  }
  return null;
}

export function cellText(row: CallDatabaseRow, key: string) {
  if (key === "who_called") return row.who_called || "—";
  if (key === "direction") {
    const meta = row.direction ? DIRECTION_META[row.direction] : null;
    return meta?.label || row.direction || "—";
  }
  if (key === "started_at") return formatWhen(row.started_at);
  if (key === "duration_seconds") return formatDuration(row.duration_seconds);
  const v = row.values?.[key];
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function EmptyDash() {
  return <span className="text-muted-foreground/50">—</span>;
}

export function DatabaseCell({
  row,
  colKey,
  field,
}: {
  row: CallDatabaseRow;
  colKey: string;
  field?: AnalysisField;
}) {
  if (colKey === "who_called") {
    const v = row.who_called?.trim();
    if (!v) return <EmptyDash />;
    return (
      <span className="font-mono text-[13px] tracking-tight text-foreground/90">{v}</span>
    );
  }

  if (colKey === "direction") {
    const meta = row.direction ? DIRECTION_META[row.direction] : null;
    if (!meta) return <EmptyDash />;
    const Icon = meta.Icon;
    return (
      <NotionChip className={meta.className}>
        <Icon className="size-3 shrink-0 opacity-80" />
        {meta.label}
      </NotionChip>
    );
  }

  if (colKey === "started_at") {
    const label = formatWhen(row.started_at);
    if (label === "—") return <EmptyDash />;
    return <span className="text-muted-foreground tabular-nums">{label}</span>;
  }

  if (colKey === "duration_seconds") {
    if (row.duration_seconds == null) return <EmptyDash />;
    return (
      <NotionChip className="bg-sky-500/12 text-sky-800 tabular-nums dark:bg-sky-500/20 dark:text-sky-200">
        {formatDuration(row.duration_seconds)}
      </NotionChip>
    );
  }

  const v = row.values?.[colKey];
  if (v == null || v === "") return <EmptyDash />;

  const type = field?.type;
  const bool = asBoolean(v);
  if (type === "boolean" || (type !== "number" && bool !== null)) {
    return bool ? (
      <NotionChip className="bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
        Yes
      </NotionChip>
    ) : (
      <NotionChip className="bg-rose-500/12 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
        No
      </NotionChip>
    );
  }

  if (Array.isArray(v)) {
    if (!v.length) return <EmptyDash />;
    return (
      <span className="inline-flex max-w-xs flex-wrap gap-1">
        {v.map((item, i) => {
          const label = String(item);
          return (
            <NotionChip key={`${label}-${i}`} className={hashTone(label)} title={label}>
              <span className="truncate">{label}</span>
            </NotionChip>
          );
        })}
      </span>
    );
  }

  if (type === "enum" || (field?.enum_values && field.enum_values.length > 0)) {
    const label = String(v);
    return (
      <NotionChip className={hashTone(label)} title={label}>
        <span className="truncate">{label}</span>
      </NotionChip>
    );
  }

  if (type === "number" || typeof v === "number") {
    return (
      <NotionChip className="bg-muted text-foreground tabular-nums">
        {typeof v === "number" ? v.toLocaleString() : String(v)}
      </NotionChip>
    );
  }

  const text = String(v);
  return (
    <span className="block max-w-xs truncate text-foreground/90" title={text}>
      {text}
    </span>
  );
}
