"use client";

import type { ReactNode } from "react";
import type { KupeIconName } from "@/components/icons/kupe-icon";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { cn } from "@/lib/utils";

/**
 * Icon map for Voice Agents empty states and feature cards.
 * Kept under the historical `AsciiIcon` name so call sites stay stable.
 */
export type AsciiIconKind =
  | "folder"
  | "phone"
  | "incoming"
  | "campaign"
  | "robot"
  | "pricing"
  | "docs"
  | "person"
  | "building"
  | "notfound"
  | "code"
  | "upload"
  | "outbound"
  | "batch"
  | "chart"
  | "forbidden"
  | "key"
  | "transfer"
  | "planStarter"
  | "planBusiness"
  | "planScale"
  | "planEnterprise";

export type AsciiIconTone =
  | "amber"
  | "coral"
  | "emerald"
  | "sky"
  | "violet"
  | "slate"
  | "rose";

const TONE_CLASS: Record<AsciiIconTone, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  coral: "text-primary",
  emerald: "text-emerald-600 dark:text-emerald-400",
  sky: "text-primary",
  violet: "text-violet-600 dark:text-violet-400",
  slate: "text-muted-foreground",
  rose: "text-rose-600 dark:text-rose-400",
};

const TONE_BG: Record<AsciiIconTone, string> = {
  amber: "bg-amber-500/10",
  coral: "bg-primary/10",
  emerald: "bg-emerald-500/10",
  sky: "bg-primary/10",
  violet: "bg-violet-500/10",
  slate: "bg-muted",
  rose: "bg-rose-500/10",
};

const ICONS: Record<AsciiIconKind, KupeIconName> = {
  folder: "folder",
  phone: "phone",
  incoming: "inbound",
  campaign: "megaphone",
  robot: "robot",
  pricing: "layers",
  docs: "book",
  person: "user",
  building: "building",
  notfound: "search-x",
  code: "braces",
  upload: "upload",
  outbound: "outbound-phone",
  batch: "layers",
  chart: "bars",
  forbidden: "ban",
  key: "key",
  transfer: "phone-transfer",
  planStarter: "layers",
  planBusiness: "layers",
  planScale: "layers",
  planEnterprise: "layers",
};

const SIZE_CLASS = {
  sm: "size-5",
  md: "size-6",
  lg: "size-7",
  xl: "size-9",
} as const;

const BOX_SIZE = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
  xl: "size-14",
} as const;

export function AsciiIcon({
  kind,
  tone = "slate",
  size = "lg",
  className,
  title,
}: {
  kind: AsciiIconKind;
  tone?: AsciiIconTone;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  title?: string;
}) {
  return (
    <span
      role={title ? "img" : "presentation"}
      aria-label={title}
      className={cn(
        "group/nav inline-flex items-center justify-center rounded-xl",
        BOX_SIZE[size],
        TONE_BG[tone],
        TONE_CLASS[tone],
        className,
      )}
    >
      <KupeIcon name={ICONS[kind]} className={SIZE_CLASS[size]} />
    </span>
  );
}

/** Centered empty-state block used across Voice Agents pages. */
export function AsciiEmptyState({
  kind,
  tone,
  title,
  description,
  actions,
  className,
}: {
  kind: AsciiIconKind;
  tone?: AsciiIconTone;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group/nav flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-elevated",
        className,
      )}
    >
      <AsciiIcon kind={kind} tone={tone} size="xl" title={title} />
      <h2 className="text-headline mt-5">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
