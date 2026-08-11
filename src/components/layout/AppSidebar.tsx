import { AudioLines, Bot, FileSearch, LogOut, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type AppView = "voice" | "agents" | "analyses" | "session";

type Props = {
  view: AppView;
  onNavigate: (view: Exclude<AppView, "session">) => void;
  email?: string | null;
  orgName?: string | null;
  onSignOut: () => void;
  sessionActive?: boolean;
};

const NAV: { id: Exclude<AppView, "session">; label: string; icon: typeof Phone }[] = [
  { id: "voice", label: "Voice", icon: Phone },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "analyses", label: "Analyses", icon: FileSearch },
];

export function AppSidebar({ view, onNavigate, email, orgName, onSignOut, sessionActive }: Props) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <AudioLines className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Kupe</div>
          <div className="truncate text-xs text-muted-foreground">Voice console</div>
        </div>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id || (id === "voice" && view === "session");
          return (
            <button
              key={id}
              type="button"
              disabled={sessionActive && id !== "voice"}
              onClick={() => onNavigate(id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                sessionActive && id !== "voice" && "cursor-not-allowed opacity-40",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-sidebar-border p-3">
        <div className="min-w-0 px-1 text-left">
          <div className="truncate text-xs font-medium text-foreground">{email}</div>
          {orgName && <div className="truncate text-xs text-muted-foreground">{orgName}</div>}
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
