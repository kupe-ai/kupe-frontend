import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  CheckSquare,
  Quote,
  type LucideIcon,
} from "lucide-react";
import type { BlockType } from "@/lib/notion-blocks";

export interface SlashOption {
  type: BlockType;
  label: string;
  icon: LucideIcon;
}

export const SLASH_OPTIONS: SlashOption[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "h1", label: "Heading 1", icon: Heading1 },
  { type: "h2", label: "Heading 2", icon: Heading2 },
  { type: "h3", label: "Heading 3", icon: Heading3 },
  { type: "bullet", label: "Bulleted list", icon: List },
  { type: "todo", label: "To-do", icon: CheckSquare },
  { type: "quote", label: "Quote", icon: Quote },
];

/** The "/" command menu — Notion's block-insert affordance. */
export function SlashMenu({
  onPick,
  activeIndex,
}: {
  onPick: (type: BlockType) => void;
  activeIndex: number;
}) {
  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
      <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">Basic blocks</p>
      {SLASH_OPTIONS.map((opt, i) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.type}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(opt.type);
            }}
            className={
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors " +
              (i === activeIndex ? "bg-accent text-foreground" : "text-foreground hover:bg-accent")
            }
          >
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
