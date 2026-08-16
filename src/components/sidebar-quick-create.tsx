"use client";

import { useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KupeIcon } from "@/components/icons/kupe-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createVoiceAgent } from "@/lib/api/voice/agents";
import { getShortcutLabel } from "@/lib/platform";
import { pushRecentActivity } from "@/lib/recent-activity";

export function SidebarQuickCreate({
  collapsed,
  onOpenSearch,
}: {
  collapsed?: boolean;
  onOpenSearch?: () => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function go(href: string, label: string) {
    pushRecentActivity(href, label);
    setMenuOpen(false);
    navigate(href);
  }

  function createAgent() {
    setMenuOpen(false);
    startTransition(async () => {
      try {
        const agent = await createVoiceAgent({ name: "New agent" });
        pushRecentActivity(`/agents/${agent.id}`, agent.name);
        navigate(`/agents/${agent.id}`);
      } catch {
        toast.error("Couldn't create agent");
      }
    });
  }

  const plusBtn = (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={menuOpen ? "Close quick create" : "Quick create"}
          className={cn(
            "group/nav flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            menuOpen && "bg-muted text-foreground",
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : menuOpen ? (
            <X className="size-3.5" />
          ) : (
            <KupeIcon name="plus" className="size-3.5" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-52">
        <DropdownMenuItem className="group/nav" onSelect={createAgent}>
          <KupeIcon name="robot" className="size-4" />
          New agent
        </DropdownMenuItem>
        <DropdownMenuItem className="group/nav" onSelect={() => go("/outbound-campaigns", "Outbound campaigns")}>
          <KupeIcon name="megaphone" className="size-4" />
          New campaign
        </DropdownMenuItem>
        <DropdownMenuItem className="group/nav" onSelect={() => go("/phone-numbers", "Phone numbers")}>
          <KupeIcon name="phone" className="size-4" />
          Phone numbers
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const searchBtn =
    collapsed && onOpenSearch ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpenSearch}
            className="group/nav flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Search"
          >
            <KupeIcon name="search" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Search
          <kbd className="ml-1.5 rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
            {getShortcutLabel("⌘K")}
          </kbd>
        </TooltipContent>
      </Tooltip>
    ) : null;

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", collapsed && "flex-col gap-1")}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{plusBtn}</span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Quick create
          </TooltipContent>
        </Tooltip>
      ) : (
        plusBtn
      )}
      {searchBtn}
    </div>
  );
}
