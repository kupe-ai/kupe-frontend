import type { ReactNode } from "react";
import { AppSidebar, type AppView } from "@/components/layout/AppSidebar";

type Props = {
  view: AppView;
  onNavigate: (view: Exclude<AppView, "session">) => void;
  email?: string | null;
  orgName?: string | null;
  onSignOut: () => void;
  sessionActive?: boolean;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  view,
  onNavigate,
  email,
  orgName,
  onSignOut,
  sessionActive,
  title,
  description,
  actions,
  children,
}: Props) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <AppSidebar
        view={view}
        onNavigate={onNavigate}
        email={email}
        orgName={orgName}
        onSignOut={onSignOut}
        sessionActive={sessionActive}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="min-w-0 text-left">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 text-left">{children}</main>
      </div>
    </div>
  );
}
