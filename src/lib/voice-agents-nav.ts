import type { KupeIconName } from "@/components/icons/kupe-icon";

export interface VoiceAgentsNavItem {
  id: string;
  label: string;
  href: string;
  icon: KupeIconName;
  flag?: string;
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
        flag: "feature_agents",
      },
      {
        id: "knowledge",
        label: "Knowledge base",
        href: "/knowledge-base",
        icon: "book",
        flag: "feature_knowledge_base",
      },
      {
        id: "voice-library",
        label: "Voice Library",
        href: "/voice-library",
        icon: "wave",
        flag: "feature_voice_library",
      },
      {
        id: "integrations",
        label: "Integrations",
        href: "/integrations",
        icon: "plug",
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
        flag: "feature_phone_numbers",
      },
      {
        id: "inbound",
        label: "Inbound calls",
        href: "/inbound-calls",
        icon: "inbound",
        flag: "feature_inbound",
      },
      {
        id: "outbound",
        label: "Outbound campaigns",
        href: "/outbound-campaigns",
        icon: "megaphone",
        flag: "feature_outbound",
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
        flag: "feature_analytics",
      },
      {
        id: "usage",
        label: "Usage",
        href: "/usage",
        icon: "line-chart",
      },
      {
        id: "billing",
        label: "Billing",
        href: "/billing",
        icon: "wallet",
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

export function filterNavByFlags<T extends { flag?: string }>(
  items: T[],
  isEnabled: (flag: string) => boolean,
): T[] {
  return items.filter((item) => !item.flag || isEnabled(item.flag));
}

export function isVoiceAgentsNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
