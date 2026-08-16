"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShortcutLabel } from "@/lib/platform";
import { ModernIcon } from "@/components/icons/modern-icon";
import { KupeIcon, type KupeIconName } from "@/components/icons/kupe-icon";
import {
  VOICE_AGENTS_FOOTER_NAV,
  VOICE_AGENTS_NAV,
  isVoiceAgentsNavActive,
} from "@/lib/voice-agents-nav";
import { pushRecentActivity, readRecentActivity } from "@/lib/recent-activity";
import { useSettingsDialogOptional } from "@/components/settings/settings-dialog-context";
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

const SETTINGS_HREF = "/settings";

const PAGE_ITEMS = [
  ...VOICE_AGENTS_NAV.flatMap((s) => s.items),
  ...VOICE_AGENTS_FOOTER_NAV.filter((item) => item.href !== SETTINGS_HREF),
];

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
] as const satisfies readonly { value: string; label: string; icon: KupeIconName }[];

function SpotThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center gap-1 border-t border-border/60 px-3 py-2.5">
      <span className="mr-auto text-[11px] font-medium text-muted-foreground">
        Theme
      </span>
      {THEME_OPTIONS.map(({ value, label, icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={`${label} theme`}
            aria-pressed={active}
            className={cn(
              "group/nav flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <KupeIcon name={icon} className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function isSettingsHref(href: string) {
  return href === SETTINGS_HREF || href.startsWith(`${SETTINGS_HREF}?`);
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const settings = useSettingsDialogOptional();
  const [query, setQuery] = useState("");
  const recents = useMemo(() => (open ? readRecentActivity() : []), [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string, label: string) {
    pushRecentActivity(href, label);
    onOpenChange(false);
    if (isSettingsHref(href)) {
      if (settings?.openSettings()) return;
      navigate(href);
      return;
    }
    navigate(href);
  }

  const q = query.trim().toLowerCase();
  const filteredPages = PAGE_ITEMS.filter(
    (item) => !q || item.label.toLowerCase().includes(q) || item.href.includes(q),
  );
  const showSettingsAction =
    !q || "settings".includes(q) || "preferences".includes(q) || "theme".includes(q);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Quick search</DialogTitle>
        <DialogDescription>
          Jump to a Voice Agents page, open settings, or change theme.
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="top-1/3 translate-y-0 overflow-hidden rounded-xl p-0 sm:max-w-lg">
        <Command className="rounded-xl border-0" shouldFilter={false}>
          <CommandInput
            placeholder="Search Voice Agents…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(50vh,360px)]">
            <CommandEmpty>No matching pages.</CommandEmpty>

            {!q && recents.length > 0 && (
              <>
                <CommandGroup heading="Recent">
                  {recents.slice(0, 5).map((item) => (
                    <CommandItem
                      key={`${item.href}-${item.at}`}
                      value={`recent ${item.label} ${item.href}`}
                      onSelect={() => go(item.href, item.label)}
                      className="group/nav gap-2.5"
                    >
                      <ModernIcon name="clock" className="size-4 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="size-3.5 text-muted-foreground/60" />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {showSettingsAction && (
              <>
                <CommandGroup heading="Quick actions">
                  <CommandItem
                    value="settings preferences configuration appearance theme"
                    onSelect={() => go(SETTINGS_HREF, "Settings")}
                    className="group/nav gap-2.5"
                  >
                    <ModernIcon name="gear" className="size-4 text-muted-foreground" />
                    <span className="flex-1">Settings</span>
                    <ChevronRight className="size-3.5 text-muted-foreground/60" />
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {filteredPages.length > 0 && (
              <CommandGroup heading="Pages">
                {filteredPages.map((item) => {
                  const active = isVoiceAgentsNavActive(pathname, item.href);
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.href} page navigate`}
                      onSelect={() => go(item.href, item.label)}
                      className={cn("group/nav gap-2.5", active && "font-semibold")}
                    >
                      <ModernIcon name={item.icon} className="size-5 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      {active && (
                        <span className="text-xs text-muted-foreground">Current</span>
                      )}
                      <ChevronRight className="size-3.5 text-muted-foreground/60" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
          <SpotThemeSwitch />
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
        "group/nav inline-flex h-9 w-full max-w-xs items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 text-left text-sm text-muted-foreground shadow-sm backdrop-blur-xl pressable hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <KupeIcon name="search" className="size-4" />
      <span className="flex-1 truncate">Quick search</span>
      <kbd className="hidden rounded-md border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.04em] sm:inline">
        {getShortcutLabel("⌘K")}
      </kbd>
    </button>
  );
}

/** Always-visible search field in the app sidebar — opens the command palette. */
export function SidebarSearchBar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/nav flex h-8 w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      aria-label="Search"
    >
      <KupeIcon name="search" className="size-3.5" />
      <span className="min-w-0 flex-1 truncate">Search</span>
      <kbd className="shrink-0 rounded border border-border bg-muted px-1 py-px font-mono text-[10px] font-medium tracking-tight text-muted-foreground">
        {getShortcutLabel("⌘K")}
      </kbd>
    </button>
  );
}
