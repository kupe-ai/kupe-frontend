"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { getShortcutLabel } from "@/lib/platform";

export interface QuickMenuAction {
  type?: "item";
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: () => void;
  children?: QuickMenuAction[];
}

export type QuickMenuEntry =
  | QuickMenuAction
  | { type: "separator" }
  | { type: "label"; label: string };

function renderEntries(entries: QuickMenuEntry[], keyPrefix = "") {
  return entries.map((entry, i) => {
    const key = `${keyPrefix}${i}`;
    if ("type" in entry && entry.type === "separator") {
      return <ContextMenuSeparator key={key} />;
    }
    if ("type" in entry && entry.type === "label") {
      return <ContextMenuLabel key={key}>{entry.label}</ContextMenuLabel>;
    }
    const action = entry as QuickMenuAction;
    const Icon = action.icon;

    if (action.children && action.children.length > 0) {
      return (
        <ContextMenuSub key={key}>
          <ContextMenuSubTrigger>
            {Icon && <Icon />}
            {action.label}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {renderEntries(action.children, `${key}-`)}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    }

    return (
      <ContextMenuItem
        key={key}
        variant={action.variant}
        disabled={action.disabled}
        onSelect={action.onSelect}
      >
        {Icon && <Icon />}
        {action.label}
        {action.shortcut && (
          <ContextMenuShortcut>{getShortcutLabel(action.shortcut)}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    );
  });
}

/**
 * Wrap any element for a branded right-click menu. Pass a declarative `items`
 * array — same pattern as Kori, used across list rows and cards.
 */
export function QuickContextMenu({
  items,
  title,
  children,
  asChild = true,
  outside = false,
}: {
  items: QuickMenuEntry[];
  title?: string;
  children: React.ReactNode;
  asChild?: boolean;
  outside?: boolean;
}) {
  if (items.length === 0) return <>{children}</>;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild={asChild}>{children}</ContextMenuTrigger>
      <ContextMenuContent
        collisionPadding={outside ? { left: 280 } : undefined}
      >
        {title && <ContextMenuLabel>{title}</ContextMenuLabel>}
        {renderEntries(items)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
