"use client";

import type { ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  connected: "success",
  active: "success",
  live: "success",
  ready: "success",
  completed: "success",
  complete: "success",
  success: "success",
  approved: "success",
  accepted: "success",
  ended: "success",
  done: "success",
  passed: "success",
  achieved: "success",
  answered: "success",

  failed: "destructive",
  error: "destructive",
  rejected: "destructive",
  cancelled: "destructive",
  canceled: "destructive",
  suspended: "destructive",
  exhausted: "destructive",
  missed: "destructive",

  pending: "warning",
  processing: "warning",
  connecting: "warning",
  queued: "warning",
  running: "warning",
  dialing: "warning",
  under_review: "warning",
  submitted: "warning",
  provisioning: "warning",
  in_progress: "warning",
  recording: "warning",
  uploading: "warning",
  starting: "warning",
  scheduled: "warning",
  pending_kyc: "warning",
  initializing: "warning",

  inbound: "info",
  info: "info",

  outbound: "violet",
  paused: "violet",
  draft: "secondary",
  archived: "secondary",
  skipped: "secondary",
  disconnected: "secondary",
  released: "secondary",
  not_evaluated: "secondary",
  idle: "secondary",
};

export function statusChipVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return "secondary";
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUS_VARIANT[key] ?? "secondary";
}

export function formatStatusLabel(status: string): string {
  return status
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusChip({
  status,
  className,
  children,
}: {
  status: string | null | undefined;
  className?: string;
  children?: ReactNode;
}) {
  if (!status || status === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge variant={statusChipVariant(status)} className={cn("font-normal capitalize", className)}>
      {children ?? formatStatusLabel(status)}
    </Badge>
  );
}
