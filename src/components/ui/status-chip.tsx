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
  fail: "destructive",
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
  user: "info",
  web: "info",
  caller_hung_up: "info",

  outbound: "violet",
  paused: "violet",
  agent: "violet",
  agent_ended_the_call: "violet",
  call_transferred: "violet",

  system: "warning",
  call_hit_the_time_limit: "warning",
  no_response_from_caller: "warning",

  call_failed_to_start: "destructive",
  agent_error: "destructive",
  call_dropped_before_anyone_joined: "destructive",

  draft: "secondary",
  archived: "secondary",
  skipped: "secondary",
  disconnected: "secondary",
  released: "secondary",
  not_evaluated: "secondary",
  idle: "secondary",
  reached_voicemail: "secondary",
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
    <Badge
      variant={statusChipVariant(status)}
      title={typeof children === "string" ? children : status}
      className={cn("font-normal capitalize whitespace-nowrap", className)}
    >
      {children ?? formatStatusLabel(status)}
    </Badge>
  );
}

/** Run-level chip: Success / Fail once finished, not "Completed". */
export function TestRunStatusChip({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (status === "queued" || status === "running") {
    return <StatusChip status={status} className={className} />;
  }
  if (status === "failed" || status === "errored" || status === "fail") {
    return (
      <StatusChip status="fail" className={className}>
        Fail
      </StatusChip>
    );
  }
  if (!status) {
    return <StatusChip status={status} className={className} />;
  }
  return (
    <StatusChip status="success" className={className}>
      Success
    </StatusChip>
  );
}
