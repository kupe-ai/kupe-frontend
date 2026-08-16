"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { KupeIcon, type KupeIconName } from "@/components/icons/kupe-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSettingsDialog,
  type SettingsSectionId,
} from "@/components/settings/settings-dialog-context";
import { SettingsSectionBody } from "@/components/settings/settings-sections";
import { useAuth } from "@/lib/useAuth";

type NavItem = {
  id: SettingsSectionId;
  label: string;
  icon: KupeIconName;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Preferences",
    items: [
      { id: "appearance", label: "Appearance", icon: "palette" },
      { id: "account", label: "Account", icon: "gear" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "workspace", label: "Workspace", icon: "users" },
      { id: "keys", label: "API Key", icon: "key" },
    ],
  },
];

const SECTION_META: Record<SettingsSectionId, { title: string; description: string }> = {
  appearance: {
    title: "Appearance",
    description: "Theme and display.",
  },
  account: {
    title: "Account",
    description: "Your account details.",
  },
  workspace: {
    title: "Workspace",
    description: "Organization, project, members, and telephony.",
  },
  keys: {
    title: "API Key",
    description: "Keys for apps and agents.",
  },
};

const FLOATING_OPEN_SELECTOR =
  '[data-slot="dropdown-menu-content"][data-state="open"], [data-slot="popover-content"][data-state="open"], [data-slot="select-content"][data-state="open"], [data-radix-popper-content-wrapper]';

function hasOpenFloatingMenu(target?: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (
    el?.closest(
      '[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="select-content"], [data-radix-popper-content-wrapper]',
    )
  ) {
    return true;
  }
  return Boolean(document.querySelector(FLOATING_OPEN_SELECTOR));
}

function hasNestedModalLayer() {
  return (
    document.querySelectorAll(
      '[data-slot="dialog-overlay"], [data-slot="sheet-overlay"], [data-slot="alert-dialog-overlay"]',
    ).length > 1
  );
}

export function SettingsDialog() {
  const { open, section, closeSettings, setSection } = useSettingsDialog();
  const { session } = useAuth();
  const email = session?.user.email ?? "";
  const suppressCloseRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = () => {
      if (hasOpenFloatingMenu() || hasNestedModalLayer()) {
        suppressCloseRef.current = true;
        window.setTimeout(() => {
          suppressCloseRef.current = false;
        }, 400);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const keepSettingsOpenForNestedLayer = useCallback(
    (event: { target: EventTarget | null; preventDefault: () => void }) => {
      if (suppressCloseRef.current || hasNestedModalLayer() || hasOpenFloatingMenu(event.target)) {
        event.preventDefault();
      }
    },
    [],
  );

  const meta = SECTION_META[section];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (
          suppressCloseRef.current ||
          hasNestedModalLayer() ||
          hasOpenFloatingMenu()
        ) {
          return;
        }
        closeSettings();
      }}
    >
      <DialogContent
        showCloseButton
        className="flex h-[min(720px,85vh)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-border/60 p-0 shadow-2xl shadow-black/10 sm:max-w-4xl"
        onPointerDownOutside={keepSettingsOpenForNestedLayer}
        onInteractOutside={keepSettingsOpenForNestedLayer}
        onFocusOutside={keepSettingsOpenForNestedLayer}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Appearance, account, workspace, and API keys.
        </DialogDescription>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-border/70 bg-sidebar">
            <div className="border-b border-border/60 bg-gradient-to-b from-primary/[0.06] to-transparent px-4 py-3.5">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                Settings
              </p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-3.5">
                  <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSection(item.id)}
                          className={cn(
                            "group/nav flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <KupeIcon
                            name={item.icon}
                            className={cn(
                              "size-5",
                              active ? "text-foreground" : "text-muted-foreground",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-card">
            <header className="shrink-0 border-b border-border/60 bg-gradient-to-r from-muted/30 via-transparent to-transparent px-6 py-4 pr-12">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {meta.title}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
            </header>
            <div key={section} className="animate-fade-in min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-16">
              <SettingsSectionBody section={section} />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
