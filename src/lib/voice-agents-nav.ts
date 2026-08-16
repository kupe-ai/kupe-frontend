import type { KupeIconName } from "@/components/icons/kupe-icon";

export interface VoiceAgentsNavItem {
  id: string;
  label: string;
  href: string;
  icon: KupeIconName;
}

export interface VoiceAgentsNavSection {
  id: string;
  label?: string;
  items: VoiceAgentsNavItem[];
}

export const VOICE_AGENTS_NAV: VoiceAgentsNavSection[] = [
  {
    id: "top",
    items: [
      {
        id: "home",
        label: "Home",
        href: "/",
        icon: "home",
      },
    ],
  },
  {
    id: "build",
    label: "Build",
    items: [
      {
        id: "agents",
        label: "Agents",
        href: "/agents",
        icon: "robot",
      },
      {
        id: "knowledge",
        label: "Knowledge base",
        href: "/knowledge-base",
        icon: "book",
      },
      {
        id: "voice-library",
        label: "Voice Library",
        href: "/voice-library",
        icon: "wave",
      },
    ],
  },
  {
    id: "deploy",
    label: "Deploy",
    items: [
      {
        id: "phone-numbers",
        label: "Phone numbers",
        href: "/phone-numbers",
        icon: "phone",
      },
      {
        id: "inbound",
        label: "Inbound calls",
        href: "/inbound-calls",
        icon: "inbound",
      },
      {
        id: "outbound",
        label: "Outbound campaigns",
        href: "/outbound-campaigns",
        icon: "megaphone",
      },
      {
        id: "deploy-code",
        label: "Deploy with code",
        href: "/deploy-with-code",
        icon: "code",
      },
    ],
  },
  {
    id: "monitor",
    label: "Monitor",
    items: [
      {
        id: "analytics",
        label: "Agent analytics",
        href: "/analytics",
        icon: "bars",
      },
      {
        id: "usage",
        label: "Usage",
        href: "/usage",
        icon: "line-chart",
      },
    ],
  },
];

export const VOICE_AGENTS_FOOTER_NAV: VoiceAgentsNavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: "gear",
  },
  {
    id: "docs",
    label: "Documentation",
    href: "/documentation",
    icon: "book",
  },
];

export function isVoiceAgentsNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
