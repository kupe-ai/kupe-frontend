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
  Tag,
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
        href: "/voice-agents",
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
        href: "/voice-agents/agents",
        icon: Bot,
      },
      {
        id: "knowledge",
        label: "Knowledge base",
        href: "/voice-agents/knowledge-base",
        icon: BookOpen,
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
        href: "/voice-agents/phone-numbers",
        icon: Phone,
      },
      {
        id: "inbound",
        label: "Inbound calls",
        href: "/voice-agents/inbound-calls",
        icon: PhoneIncoming,
      },
      {
        id: "outbound",
        label: "Outbound campaigns",
        href: "/voice-agents/outbound-campaigns",
        icon: Megaphone,
      },
      {
        id: "deploy-code",
        label: "Deploy with code",
        href: "/voice-agents/deploy-with-code",
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
        href: "/voice-agents/analytics",
        icon: BarChart3,
      },
    ],
  },
];

export const VOICE_AGENTS_FOOTER_NAV: VoiceAgentsNavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/voice-agents/settings",
    icon: Settings,
  },
  {
    id: "pricing",
    label: "Pricing",
    href: "/voice-agents/pricing",
    icon: Tag,
  },
  {
    id: "docs",
    label: "Documentation",
    href: "/voice-agents/documentation",
    icon: BookOpen,
  },
];

export function isVoiceAgentsNavActive(pathname: string, href: string) {
  if (href === "/voice-agents") return pathname === "/voice-agents";
  return pathname === href || pathname.startsWith(href + "/");
}
