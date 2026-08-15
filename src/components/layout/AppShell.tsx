"use client";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ComponentType } from "react";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandLockup } from "@/components/brand/wordmark";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { SidebarQuickCreate } from "@/components/sidebar-quick-create";
import { SidebarWorkspaceMenu } from "@/components/sidebar-workspace-menu";
import { SidebarCollapseProvider } from "@/components/sidebar-collapse";
import {
  VOICE_AGENTS_FOOTER_NAV,
  VOICE_AGENTS_NAV,
  isVoiceAgentsNavActive,
} from "@/lib/voice-agents-nav";
import { pushRecentActivity } from "@/lib/recent-activity";

const COLLAPSE_KEY = "kupe:sidebar-collapsed";

function NavLinks({
  pathname,
  collapsed,
  onNavigate,
  groups = VOICE_AGENTS_NAV,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  groups?: { id: string; label?: string; items: typeof VOICE_AGENTS_FOOTER_NAV }[];
}) {
  let idx = 0;

  return (
    <nav className={cn("flex flex-col", collapsed ? "gap-1" : "gap-3")}>
      {groups.map((group) => (
        <div key={group.id} className={cn("flex flex-col", collapsed ? "gap-1" : "gap-0.5")}>
          {!collapsed && "label" in group && group.label && (
            <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const active = isVoiceAgentsNavActive(pathname, item.href);
            const Icon = item.icon as ComponentType<{ className?: string }>;
            const delay = idx++ * 30;
            const className = cn(
              "animate-fade-in-up flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-all duration-150",
              collapsed && "size-8 justify-center px-0",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground ring-1 ring-border/40"
                : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:ring-1 hover:ring-border/35",
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <span className="flex w-full justify-center">
                    <Link
                      to={item.href}
                      onClick={() => {
                        pushRecentActivity(item.href, item.label);
                        onNavigate?.();
                      }}
                      style={{ animationDelay: `${delay}ms` }}
                      className={className}
                    >
                      <Icon className="size-4 shrink-0" />
                    </Link>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => {
                  pushRecentActivity(item.href, item.label);
                  onNavigate?.();
                }}
                style={{ animationDelay: `${delay}ms` }}
                className={className}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isEditor = /^\/voice-agents\/agents\/[^/]+\/?$/.test(pathname);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setMounted(true);
  }, []);

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "," && !e.shiftKey) {
        e.preventDefault();
        navigate("/voice-agents/settings");
        return;
      }
      if (e.key?.toLowerCase() === "f" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
          return;
        }
        e.preventDefault();
        const candidates = Array.from(
          document.querySelectorAll<HTMLInputElement>("input[data-page-search]"),
        );
        const visible = candidates.find((el) => {
          if (el.disabled) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (visible) {
          visible.focus();
          visible.select();
          return;
        }
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const primary = [
    VOICE_AGENTS_NAV[0]?.items[0],
    VOICE_AGENTS_NAV[1]?.items[0],
    VOICE_AGENTS_NAV[2]?.items[0],
  ].filter(Boolean);

  return (
    <SidebarCollapseProvider collapsed={collapsed} toggleCollapsed={toggleCollapsed}>
      <div className="flex h-dvh w-full gap-3 overflow-hidden bg-background p-3 print:block print:h-auto print:gap-0 print:overflow-visible print:bg-white print:p-0">
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

        {/* Desktop floating sidebar — canvas peeks top/bottom/left */}
        <aside
          className={cn(
            "hidden h-full min-h-0 shrink-0 flex-col rounded-2xl border border-border bg-sidebar pt-1.5 shadow-elevated md:flex print:hidden",
            mounted && "transition-[width] duration-300 ease-in-out",
            collapsed ? "w-14" : "w-[220px]",
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center gap-1",
              collapsed ? "flex-col justify-center gap-1.5 px-1 py-2" : "px-2.5 py-2",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center",
                collapsed ? "w-full justify-center" : "flex-1",
              )}
            >
              <Link
                to="/voice-agents"
                className={cn(
                  "flex min-w-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  collapsed && "justify-center rounded-md p-0.5 hover:bg-sidebar-accent",
                )}
                aria-label="Kupe home"
              >
                <BrandLockup collapsed={collapsed} height={22} />
              </Link>
            </div>
            <SidebarQuickCreate collapsed={collapsed} onOpenSearch={() => setSearchOpen(true)} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={toggleCollapsed}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="size-3.5" />
                  ) : (
                    <PanelLeftClose className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto pt-0.5",
              collapsed ? "items-center px-1" : "px-2.5",
            )}
          >
            <div className={cn("shrink-0", collapsed && "flex w-full flex-col items-center")}>
              <NavLinks pathname={pathname} collapsed={collapsed} />
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col gap-0.5",
              collapsed ? "items-center px-1 pb-1" : "px-2.5 pb-1",
            )}
          >
            <NavLinks
              pathname={pathname}
              collapsed={collapsed}
              groups={[{ id: "footer", items: VOICE_AGENTS_FOOTER_NAV }]}
            />
          </div>

          <div
            className={cn(
              "flex shrink-0 items-center",
              collapsed ? "justify-center px-1 pb-2 pt-1" : "px-2.5 pb-2 pt-1",
            )}
          >
            <div className={cn("min-w-0", collapsed ? "w-full" : "flex-1")}>
              <SidebarWorkspaceMenu collapsed={collapsed} />
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-pane text-pane-foreground shadow-elevated print:rounded-none print:border-0 print:bg-white print:shadow-none">
          {/* Mobile header */}
          <header className="flex h-14 items-center justify-between gap-2 border-b border-border px-4 md:hidden print:hidden">
            <Link to="/voice-agents" className="flex items-center gap-1.5">
              <BrandLockup height={22} />
            </Link>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <Search className="size-4" />
              </Button>
              <SidebarWorkspaceMenu />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-hidden pb-24 md:pb-0 print:overflow-visible print:pb-0">
            <div
              className={cn(
                "animate-fade-in mx-auto h-full w-full max-w-none p-0",
                isEditor ? "overflow-hidden" : "overflow-y-auto",
              )}
            >
              {children}
            </div>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-stretch overflow-hidden rounded-2xl border border-border bg-card/95 shadow-elevated backdrop-blur md:hidden print:hidden">
          {primary.map((item) => {
            if (!item) return null;
            const active = isVoiceAgentsNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="size-5" />
              More
            </button>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <div className="p-3">
                <NavLinks pathname={pathname} onNavigate={() => setSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </SidebarCollapseProvider>
  );
}
