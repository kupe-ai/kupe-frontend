"use client";

import { ThemeSelector } from "@/components/theme-selector";
import { ApiKeysSection } from "@/components/settings/api-keys-section";
import { KupeWorkspaceSettings } from "@/pages/voice-agents/settings/workspace-sections";
import { useAuth } from "@/lib/useAuth";
import { useWorkspaceOptional } from "@/context/workspace-context";
import type { SettingsSectionId } from "@/components/settings/settings-dialog-context";

export function SettingsSectionBody({ section }: { section: SettingsSectionId }) {
  if (section === "appearance") {
    return (
      <div className="space-y-4">
        <SettingRow label="Theme" description="Theme preference.">
          <ThemeSelector />
        </SettingRow>
      </div>
    );
  }

  if (section === "workspace") {
    return <KupeWorkspaceSettings />;
  }

  if (section === "keys") {
    return <ApiKeysSection />;
  }

  if (section === "account") {
    return <AccountSection />;
  }

  return null;
}

function AccountSection() {
  const { session } = useAuth();
  const workspace = useWorkspaceOptional();
  const email = session?.user.email ?? "";
  const name =
    (session?.user.user_metadata?.full_name as string | undefined)?.trim() ||
    email.split("@")[0] ||
    "Account";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const role = workspace?.membership?.role ?? "member";
  const orgName = workspace?.org?.name ?? "Kupe";

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background p-5 sm:p-6">
        <div
          aria-hidden
          className="kupe-hero-fill pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-25"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-primary/10 blur-2xl"
        />
        <div className="relative flex items-start gap-4">
          <div className="kupe-hero-fill flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold tracking-tight text-primary-foreground shadow-sm shadow-primary/25">
            {initials}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
              {name}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
              <span className="inline-flex items-center rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                Kupe · {orgName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AccountDetailCard label="Product" value="Kupe" hint="Voice agents console" />
        <AccountDetailCard label="Vendor" value="iNavLabs" hint="Organization provider" />
        <AccountDetailCard
          label="Organization"
          value={orgName}
          hint="Current workspace"
        />
        <AccountDetailCard
          label="Project"
          value={workspace?.project?.name ?? "—"}
          hint="Active project"
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Signed in as
        </p>
        <div className="mt-2 flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-foreground">{name}</span>
          <span className="truncate text-muted-foreground">{email}</span>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 sm:max-w-[240px]">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0 flex-1 sm:flex sm:justify-end">{children}</div>
    </div>
  );
}

function AccountDetailCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3.5 shadow-sm shadow-black/[0.02]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
