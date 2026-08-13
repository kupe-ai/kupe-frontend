import type { ReactNode } from "react";
import { AppSidebar, type AppView } from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";

type Props = {
  view: AppView;
  onNavigate: (view: Exclude<AppView, "session" | "agent-builder">) => void;
  email?: string | null;
  orgName?: string | null;
  projectName?: string | null;
  onSignOut: () => void;
  sessionActive?: boolean;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Hide chrome header and main padding for full-bleed builders. */
  flush?: boolean;
  children: ReactNode;
};

export function AppShell({
  view,
  onNavigate,
  email,
  orgName,
  projectName,
  onSignOut,
  sessionActive,
  title,
  description,
  actions,
  flush,
  children,
}: Props) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <AppSidebar
        view={view}
        onNavigate={onNavigate}
        email={email}
        orgName={orgName}
        projectName={projectName}
        onSignOut={onSignOut}
        sessionActive={sessionActive}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!flush && (
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
            <div className="min-w-0 text-left">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
              {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </header>
        )}
        <main
          className={cn(
            "min-h-0 flex-1 overscroll-contain text-left",
            flush ? "overflow-hidden p-0" : "overflow-y-auto p-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
