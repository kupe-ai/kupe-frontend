"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Clock, Monitor, Moon, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShortcutLabel } from "@/lib/platform";
import {
  VOICE_AGENTS_FOOTER_NAV,
  VOICE_AGENTS_NAV,
} from "@/lib/voice-agents-nav";
import { pushRecentActivity, readRecentActivity } from "@/lib/recent-activity";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NAV_ITEMS = [
  ...VOICE_AGENTS_NAV.flatMap((s) => s.items),
  ...VOICE_AGENTS_FOOTER_NAV,
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const recents = useMemo(() => (open ? readRecentActivity() : []), [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string, label: string) {
    pushRecentActivity(href, label);
    onOpenChange(false);
    navigate(href);
  }

  const q = query.trim().toLowerCase();
  const filtered = NAV_ITEMS.filter(
    (item) => !q || item.label.toLowerCase().includes(q) || item.href.includes(q),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Quick search</DialogTitle>
          <DialogDescription>Jump to a Voice Agents page or change theme.</DialogDescription>
        </DialogHeader>
        <Command className="rounded-2xl" shouldFilter={false}>
          <CommandInput
            placeholder="Search Voice Agents…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matching pages.</CommandEmpty>
            {recents.length > 0 && !q && (
              <CommandGroup heading="Recent">
                {recents.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.href}
                    onSelect={() => go(item.href, item.label)}
                  >
                    <Clock className="size-4 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Go to">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.href}
                    onSelect={() => go(item.href, item.label)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Theme">
              <CommandItem onSelect={() => { setTheme("light"); onOpenChange(false); }}>
                <Sun className="size-4" /> Light
              </CommandItem>
              <CommandItem onSelect={() => { setTheme("dark"); onOpenChange(false); }}>
                <Moon className="size-4" /> Dark
              </CommandItem>
              <CommandItem onSelect={() => { setTheme("system"); onOpenChange(false); }}>
                <Monitor className="size-4" /> System
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-full max-w-xs items-center gap-2 rounded-full border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/60",
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate">Quick search</span>
      <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        {getShortcutLabel("⌘K")}
      </kbd>
    </button>
  );
}
