"use client";

import { useMemo, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import {
  Building2,
  Check,
  ChevronUp,
  FolderKanban,
  Library,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings2,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getShortcutLabel } from "@/lib/platform";
import { useAuth } from "@/lib/useAuth";
import { useWorkspace } from "@/context/workspace-context";
import { pushRecentActivity } from "@/lib/recent-activity";
import { useSettingsDialog } from "@/components/settings/settings-dialog-context";

function initials(name: string) {
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : "?";
}

/** Sidebar footer menu — switch org/project, account actions, sign out. */
export function SidebarWorkspaceMenu({
  collapsed,
}: {
  collapsed?: boolean;
}) {
  const { session, signOut } = useAuth();
  const workspace = useWorkspace();
  const settings = useSettingsDialog();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const email = session?.user.email ?? "";
  const name =
    (session?.user.user_metadata?.full_name as string | undefined)?.trim() ||
    email.split("@")[0] ||
    "Account";
  const workspaceLabel = workspace.org?.name ?? "Workspace";
  const roleLabel =
    workspace.membership?.role === "owner"
      ? "Owner"
      : workspace.membership?.role === "admin"
        ? "Admin"
        : "Member";

  const filteredOrgs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspace.orgs;
    return workspace.orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [workspace.orgs, query]);

  const trigger = (
    <button
      type="button"
      data-testid="workspace-switcher-trigger"
      aria-label={workspaceLabel}
      className={cn(
        "flex min-w-0 items-center text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        collapsed
          ? "justify-center rounded-md p-0.5 hover:bg-sidebar-accent"
          : "w-full gap-1.5 rounded-full bg-muted px-2 py-1 hover:bg-muted/80",
      )}
    >
      {collapsed ? (
        <Avatar className="size-6 shrink-0 after:hidden">
          <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
            {initials(workspaceLabel)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <>
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-sm ring-1 ring-border/60">
            <Library className="size-3" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
            {workspaceLabel}
          </span>
          <ChevronUp className="size-3 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  );

  const menu = (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={6}
        collisionPadding={12}
        className="w-72"
      >
        <DropdownMenuLabel className="flex items-start gap-2.5 font-normal">
          <Avatar className="size-9 shrink-0 after:hidden">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initials(workspaceLabel)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="truncate text-sm font-semibold">{workspaceLabel}</div>
            <div className="truncate text-xs text-muted-foreground">
              {roleLabel} · {name}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            pushRecentActivity("/settings", "Settings");
            settings.openSettings();
          }}
        >
          <Settings2 className="size-4" />
          Settings
          <DropdownMenuShortcut>{getShortcutLabel("⌘,")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>

        {workspace.orgs.length > 0 && (
          <div className="px-2 pb-1 pt-0.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search workspaces…"
                className="h-7 border-border/60 bg-background pl-7 text-xs"
                aria-label="Search workspaces"
              />
            </div>
          </div>
        )}

        <div className="max-h-52 overflow-y-auto">
          {filteredOrgs.map((org) => {
            const active = org.id === workspace.org?.id;
            return (
              <DropdownMenuItem
                key={org.id}
                data-testid="workspace-switcher-item"
                onSelect={(e) => {
                  e.preventDefault();
                  workspace.selectOrg(org.id);
                  setMenuOpen(false);
                  setQuery("");
                }}
              >
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                <Check className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
              </DropdownMenuItem>
            );
          })}
          {workspace.orgs.length > 0 && filteredOrgs.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No workspaces match “{query.trim()}”
            </div>
          )}
        </div>

        {workspace.projects.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {workspace.projects.map((project) => {
              const active = project.id === workspace.project?.id;
              return (
                <DropdownMenuItem
                  key={project.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    workspace.selectProject(project);
                    setMenuOpen(false);
                  }}
                >
                  <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <Check className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuItem
          onSelect={() => {
            pushRecentActivity("/settings", "New workspace");
            settings.openSettings("workspace");
          }}
        >
          <Plus className="size-4 text-primary" />
          <span className="text-primary">Workspace settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={pending}
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => {
              void signOut().catch(() => toast.error("Could not sign out"));
            });
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Log out
          <DropdownMenuShortcut>{getShortcutLabel("⇧⌘Q")}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!collapsed) return menu;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex w-full justify-center">{menu}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {workspaceLabel}
      </TooltipContent>
    </Tooltip>
  );
}
