"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/notion-blocks";

function placeCaretAtEnd(el: HTMLElement | null) {
  if (!el) return;
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

const TYPE_CLASS: Record<Block["type"], string> = {
  text: "text-sm text-foreground",
  h1: "text-xl font-bold text-foreground",
  h2: "text-lg font-bold text-foreground",
  h3: "text-base font-semibold text-foreground",
  bullet: "text-sm text-foreground",
  todo: "text-sm text-foreground",
  "todo-done": "text-sm text-muted-foreground line-through",
  quote: "text-sm italic text-muted-foreground",
};

const PLACEHOLDER: Record<Block["type"], string> = {
  text: "Type '/' for commands…",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  bullet: "List item",
  todo: "To-do",
  "todo-done": "To-do",
  quote: "Quote",
};

/**
 * One editable line in the block editor. Uncontrolled by design — its DOM
 * text content is only synced from `block.text` when the block identity
 * changes (new block / undo), never on every keystroke, so the caret never
 * jumps mid-typing.
 */
export function BlockLine({
  block,
  autoFocus,
  onInput,
  onEnter,
  onBackspaceEmpty,
  onToggleDone,
  onKeyDownExtra,
  placeholderOverride,
}: {
  block: Block;
  autoFocus?: boolean;
  onInput: (text: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onToggleDone?: () => void;
  /** Return true to signal the parent handled the key (skip default logic). */
  onKeyDownExtra?: (e: React.KeyboardEvent<HTMLDivElement>) => boolean;
  placeholderOverride?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (ref.current && ref.current.textContent !== block.text) {
      ref.current.textContent = block.text;
    }
    if (autoFocus && !mounted.current) {
      ref.current?.focus();
      placeCaretAtEnd(ref.current);
    }
    mounted.current = true;
    // Re-sync on identity or type change (e.g. a slash-menu conversion,
    // which always pairs with a text reset) — but never on every keystroke
    // of the same block/type, which would fight the caret mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, block.type]);

  // Programmatic text updates (e.g. @mention insert) — DOM and props can
  // diverge while focused. Typing keeps them equal via onInput, so this is a no-op then.
  useEffect(() => {
    const el = ref.current;
    if (!el || el.textContent === block.text) return;
    el.textContent = block.text;
    if (document.activeElement === el) placeCaretAtEnd(el);
  }, [block.text]);

  const isTodo = block.type === "todo" || block.type === "todo-done";

  return (
    <div className="group/block flex items-start gap-1.5">
      {block.type === "bullet" && (
        <span className="mt-2 flex size-4 shrink-0 items-center justify-center text-foreground">•</span>
      )}
      {isTodo && (
        <button
          type="button"
          onClick={onToggleDone}
          className={cn(
            "mt-1.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
            block.type === "todo-done"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary",
          )}
        >
          {block.type === "todo-done" && (
            <svg viewBox="0 0 10 10" className="size-2.5"><path d="M1 5l2.5 2.5L9 2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
      )}
      {block.type === "quote" && <span className="mt-0.5 h-full w-0.5 shrink-0 self-stretch rounded-full bg-primary/40" />}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholderOverride ?? PLACEHOLDER[block.type]}
        className={cn(
          "min-w-0 flex-1 py-0.5 leading-relaxed outline-none empty:before:text-foreground/35 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-foreground/50",
          TYPE_CLASS[block.type],
        )}
        onInput={(e) => onInput(e.currentTarget.textContent ?? "")}
        onKeyDown={(e) => {
          if (onKeyDownExtra?.(e)) return;
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
            return;
          }
          if (e.key === "Backspace" && (e.currentTarget.textContent ?? "") === "") {
            e.preventDefault();
            onBackspaceEmpty();
          }
        }}
      />
    </div>
  );
}
