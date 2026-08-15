"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { BrandLockup } from "@/components/brand/wordmark";
import { CommandPalette, SearchTrigger } from "@/components/layout/CommandPalette";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  VOICE_AGENTS_FOOTER_NAV,
  VOICE_AGENTS_NAV,
  isVoiceAgentsNavActive,
} from "@/lib/voice-agents-nav";
import { useAuth } from "@/lib/useAuth";
import { useWorkspaceOptional } from "@/context/workspace-context";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { session, signOut } = useAuth();
  const workspace = useWorkspaceOptional();
  const { theme, setTheme } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const email = session?.user.email ?? "";
  const initial = email.trim()[0]?.toUpperCase() ?? "K";
  const isEditor = /^\/voice-agents\/agents\/[^/]+\/?$/.test(pathname);

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-background">
      {!isEditor && (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
          <Link to="/voice-agents" className="shrink-0">
            <BrandLockup />
          </Link>
          <div className="mx-auto hidden min-w-0 flex-1 justify-center sm:flex">
            <SearchTrigger onClick={() => setCmdOpen(true)} />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              onClick={() => setCmdOpen(true)}
              aria-label="Quick search"
            >
              <span className="sr-only">Search</span>
              ⌘K
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Account">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-medium">{email}</div>
                  {workspace?.org && (
                    <div className="truncate text-xs text-muted-foreground">{workspace.org.name}</div>
                  )}
                  {workspace?.project && (
                    <div className="truncate text-xs text-muted-foreground">{workspace.project.name}</div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/voice-agents/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">Voice Agents</SheetTitle>
          <div className="border-b border-border px-4 py-4">
            <BrandLockup />
          </div>
          <nav className="flex flex-col gap-4 overflow-y-auto px-2 py-3">
            {VOICE_AGENTS_NAV.map((section) => (
              <div key={section.id} className="flex flex-col gap-0.5">
                {section.label && (
                  <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    {section.label}
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isVoiceAgentsNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-auto border-t border-border px-2 py-3">
            {VOICE_AGENTS_FOOTER_NAV.map((item) => {
              const Icon = item.icon;
              const active = isVoiceAgentsNavActive(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
