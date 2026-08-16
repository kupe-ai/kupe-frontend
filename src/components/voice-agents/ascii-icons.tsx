"use client";

import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  BookOpenText,
  BracketsCurly,
  Buildings,
  ChartBar,
  FolderOpen,
  Key,
  MagnifyingGlassMinus,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Prohibit,
  Robot,
  Stack,
  UploadSimple,
  User,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ModernIcon } from "@/components/icons/modern-icon";

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

const ICONS: Record<AsciiIconKind, Icon> = {
  folder: FolderOpen,
  phone: Phone,
  incoming: PhoneIncoming,
  campaign: ChartBar,
  robot: Robot,
  pricing: Stack,
  docs: BookOpenText,
  person: User,
  building: Buildings,
  notfound: MagnifyingGlassMinus,
  code: BracketsCurly,
  upload: UploadSimple,
  outbound: PhoneOutgoing,
  batch: Stack,
  chart: ChartBar,
  forbidden: Prohibit,
  key: Key,
  planStarter: Stack,
  planBusiness: Stack,
  planScale: Stack,
  planEnterprise: Stack,
};

const SIZE_CLASS = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
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
      <ModernIcon icon={ICONS[kind]} className={SIZE_CLASS[size]} />
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
        "flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-elevated",
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
