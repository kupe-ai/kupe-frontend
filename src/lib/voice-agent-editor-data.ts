/** Agent editor section nav — Lucide icons, no glyph art. */

import type { LucideIcon } from "lucide-react";
import {
  Braces,
  CheckSquare,
  FileText,
  Settings2,
  Wrench,
} from "lucide-react";

export type AgentEditorSection =
  | "instructions"
  | "variables"
  | "tools"
  | "settings"
  | "tests";

export const AGENT_EDITOR_NAV: {
  id: AgentEditorSection;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "instructions", label: "Instructions", icon: FileText },
  { id: "variables", label: "Variables", icon: Braces },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "tests", label: "Tests", icon: CheckSquare },
];
