import type { Icon } from "@phosphor-icons/react";
import {
  BookOpenText,
  ChartBar,
  ChartLine,
  Code,
  GearSix,
  House,
  Megaphone,
  Phone,
  PhoneIncoming,
  Robot,
  Waveform,
} from "@phosphor-icons/react";

export interface VoiceAgentsNavItem {
  id: string;
  label: string;
  href: string;
  icon: Icon;
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
        icon: House,
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
        icon: Robot,
      },
      {
        id: "knowledge",
        label: "Knowledge base",
        href: "/knowledge-base",
        icon: BookOpenText,
      },
      {
        id: "voice-library",
        label: "Voice Library",
        href: "/voice-library",
        icon: Waveform,
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
        icon: Phone,
      },
      {
        id: "inbound",
        label: "Inbound calls",
        href: "/inbound-calls",
        icon: PhoneIncoming,
      },
      {
        id: "outbound",
        label: "Outbound campaigns",
        href: "/outbound-campaigns",
        icon: Megaphone,
      },
      {
        id: "deploy-code",
        label: "Deploy with code",
        href: "/deploy-with-code",
        icon: Code,
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
        icon: ChartBar,
      },
      {
        id: "usage",
        label: "Usage",
        href: "/usage",
        icon: ChartLine,
      },
    ],
  },
];

export const VOICE_AGENTS_FOOTER_NAV: VoiceAgentsNavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: GearSix,
  },
  {
    id: "docs",
    label: "Documentation",
    href: "/documentation",
    icon: BookOpenText,
  },
];

export function isVoiceAgentsNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
