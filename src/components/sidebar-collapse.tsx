"use client";

import { createContext, useContext } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarCollapseContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

export function SidebarCollapseProvider({
  collapsed,
  toggleCollapsed,
  children,
}: {
  collapsed: boolean;
  toggleCollapsed: () => void;
  children: React.ReactNode;
}) {
  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggleCollapsed }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}

/** Inline collapse control for page toolbars (CRM / Projects). */
export function SidebarCollapseToolbarButton({ className }: { className?: string }) {
  const ctx = useSidebarCollapse();
  if (!ctx) return null;
  const { collapsed, toggleCollapsed } = ctx;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground", className)}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {collapsed ? "Expand sidebar" : "Collapse sidebar"}
      </TooltipContent>
    </Tooltip>
  );
}
