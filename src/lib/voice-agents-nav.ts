import {
  Home,
  Bot,
  BookOpen,
  Phone,
  PhoneIncoming,
  Megaphone,
  Code2,
  BarChart3,
  Settings,
  AudioLines,
  type LucideIcon,
} from "lucide-react";

export interface VoiceAgentsNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
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
        icon: Home,
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
        icon: Bot,
      },
      {
        id: "knowledge",
        label: "Knowledge base",
        href: "/knowledge-base",
        icon: BookOpen,
      },
      {
        id: "voice-library",
        label: "Voice Library",
        href: "/voice-library",
        icon: AudioLines,
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
        icon: Code2,
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
        icon: BarChart3,
      },
    ],
  },
];

export const VOICE_AGENTS_FOOTER_NAV: VoiceAgentsNavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    id: "docs",
    label: "Documentation",
    href: "/documentation",
    icon: BookOpen,
  },
];

export function isVoiceAgentsNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
