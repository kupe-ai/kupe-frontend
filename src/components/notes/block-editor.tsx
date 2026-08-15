"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMac } from "@/lib/platform";
import { BlockLine } from "./block-line";
import { SlashMenu, SLASH_OPTIONS } from "./slash-menu";
import { parseBlocks, serializeBlocks, type Block, type BlockType } from "@/lib/notion-blocks";

/**
 * Notion-inspired block editor used for agent instructions.
 * "/" opens the block type menu. Persistence is the caller's job via onChange.
 */
export function BlockEditor({
  initialValue,
  onChange,
  onSubmit,
  mode = "page",
  placeholder,
  resetKey,
}: {
  initialValue?: string | null;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  mode?: "page" | "comment";
  placeholder?: string;
  resetKey?: string | number;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(initialValue));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReset = useRef(resetKey);

  const canSubmit = useMemo(() => serializeBlocks(blocks).trim().length > 0, [blocks]);

  useEffect(() => {
    if (resetKey === undefined || resetKey === prevReset.current) return;
    prevReset.current = resetKey;
    setBlocks(parseBlocks(""));
    setSlashFor(null);
    setFocusId(null);
  }, [resetKey]);

  useEffect(() => {
    if (!onChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(serializeBlocks(blocks)), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [blocks, onChange]);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertAfter(id: string, type: BlockType = "text") {
    const newBlock: Block = { id: crypto.randomUUID(), type, text: "" };
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === id);
      const next = [...bs];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setFocusId(newBlock.id);
  }

  function removeBlock(id: string) {
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === id);
      if (idx <= 0) return bs;
      const prev = bs[idx - 1];
      setFocusId(prev.id);
      return bs.filter((b) => b.id !== id);
    });
  }

  function submitCurrent() {
    if (!onSubmit) return;
    const value = serializeBlocks(blocks).trim();
    if (!value) return;
    onSubmit(value);
    setBlocks(parseBlocks(""));
    setSlashFor(null);
  }

  return (
    <div className={cn("flex flex-col", mode === "comment" ? "gap-2" : "gap-0.5")}>
      <div className="flex flex-col gap-0.5">
        {blocks.map((block) => (
          <div key={block.id} className="relative">
            <BlockLine
              block={block}
              autoFocus={focusId === block.id}
              placeholderOverride={
                mode === "comment" && block.type === "text"
                  ? (placeholder ?? "Add a comment…")
                  : placeholder
              }
              onToggleDone={() =>
                updateBlock(block.id, {
                  type: block.type === "todo-done" ? "todo" : "todo-done",
                })
              }
              onInput={(text) => {
                updateBlock(block.id, { text });
                if (text === "/") {
                  setSlashFor(block.id);
                  setSlashIndex(0);
                } else if (slashFor === block.id && !text.startsWith("/")) {
                  setSlashFor(null);
                }
              }}
              onEnter={() => {
                if (slashFor === block.id) return;
                insertAfter(block.id);
              }}
              onBackspaceEmpty={() => removeBlock(block.id)}
              onKeyDownExtra={(e) => {
                if (mode === "comment" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitCurrent();
                  return true;
                }
                if (slashFor !== block.id) return false;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) => (i + 1) % SLASH_OPTIONS.length);
                  return true;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((i) => (i - 1 + SLASH_OPTIONS.length) % SLASH_OPTIONS.length);
                  return true;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  updateBlock(block.id, { type: SLASH_OPTIONS[slashIndex].type, text: "" });
                  setSlashFor(null);
                  setFocusId(block.id);
                  return true;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSlashFor(null);
                  return true;
                }
                return false;
              }}
            />
            {slashFor === block.id && (
              <SlashMenu
                activeIndex={slashIndex}
                onPick={(type) => {
                  updateBlock(block.id, { type, text: "" });
                  setSlashFor(null);
                  setFocusId(block.id);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {mode === "comment" && onSubmit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submitCurrent}
            disabled={!canSubmit}
            aria-label="Post comment"
            title={`Post (${isMac() ? "⌘" : "Ctrl+"}Enter)`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
