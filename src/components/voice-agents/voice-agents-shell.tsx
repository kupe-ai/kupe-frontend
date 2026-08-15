"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  VOICE_AGENTS_FOOTER_NAV,
  VOICE_AGENTS_NAV,
  isVoiceAgentsNavActive,
} from "@/lib/voice-agents-nav";

function NavLinkRow({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      to={href}
      title={collapsed ? label : undefined}
      className={cn("nav-item", collapsed && "justify-center px-2", active && "is-active")}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

/** Secondary rail for Voice Agents — sits beside main AppShell sidebar. */
export function VoiceAgentsShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  // Agent editor is its own full chrome (section nav + Ask Kupe).
  const isAgentEditor = /^\/voice-agents\/agents\/[^/]+\/?$/.test(pathname);
  if (isAgentEditor) {
    return (
      <div className="flex h-full min-h-0 w-full overflow-hidden">{children}</div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside
        className={cn(
          "material-sidebar hidden shrink-0 flex-col md:flex",
          collapsed ? "w-14" : "w-[232px]",
        )}
      >
        <div
          className={cn(
            "flex h-12 shrink-0 items-center",
            collapsed ? "justify-center px-2" : "justify-between px-3",
          )}
        >
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-[-0.014em]">
              Voice Agents
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
          {VOICE_AGENTS_NAV.map((section) => (
            <div key={section.id} className="flex flex-col gap-0.5">
              {section.label && !collapsed && (
                <div className="text-caption px-2.5 pb-1 uppercase tracking-[0.06em]">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => (
                <NavLinkRow
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isVoiceAgentsNavActive(pathname, item.href)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 px-2 py-3">
          {VOICE_AGENTS_FOOTER_NAV.map((item) => (
            <NavLinkRow
              key={item.id}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isVoiceAgentsNavActive(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
