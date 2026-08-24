/** Agent editor section nav — animated pack icons. */

import type { KupeIconName } from "@/components/icons/kupe-icon";

export type AgentEditorSection =
  | "instructions"
  | "variables"
  | "databases"
  | "tools"
  | "transfer"
  | "settings"
  | "tests";

export const AGENT_EDITOR_NAV: {
  id: AgentEditorSection;
  label: string;
  icon: KupeIconName;
}[] = [
  { id: "instructions", label: "Instructions", icon: "file" },
  { id: "variables", label: "Variables", icon: "braces" },
  { id: "databases", label: "Databases", icon: "layers" },
  { id: "tools", label: "Tools", icon: "wrench" },
  { id: "transfer", label: "Transfer", icon: "phone-transfer" },
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "tests", label: "Tests", icon: "check-square" },
];
