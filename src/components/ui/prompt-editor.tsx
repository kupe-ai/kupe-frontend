"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import { cn } from "@/lib/utils";
import { highlightPromptVariables } from "@/lib/prompt-variables";
import { ScrollArea } from "@/components/ui/scroll-area";

export const PromptEditor = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    minHeight?: string;
    maxHeight?: string;
    contentPadding?: number | string;
  }
>(function PromptEditor(
  {
    value,
    onChange,
    placeholder,
    className,
    minHeight = "150px",
    maxHeight,
    contentPadding = 12,
  },
  _ref,
) {
  const fillScrollArea = maxHeight === undefined;
  const hasFixedHeight = maxHeight != null && maxHeight !== "";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const localValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const dirtyRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  useEffect(() => {
    if (dirtyRef.current) {
      if (value === localValueRef.current) dirtyRef.current = false;
      return;
    }
    setLocalValue(value);
    localValueRef.current = value;
  }, [value]);

  const handleChange = useCallback((next: string) => {
    dirtyRef.current = true;
    localValueRef.current = next;
    setLocalValue(next);
    onChangeRef.current(next);
  }, []);

  useEffect(() => {
    if (!hasFixedHeight) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const canScroll = scrollHeight > clientHeight + 1;
      if (canScroll) {
        const canScrollUp = scrollTop > 0;
        const canScrollDown = scrollTop + clientHeight < scrollHeight - 1;
        if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
          scrollEl.scrollTop += e.deltaY;
        }
      }
      e.preventDefault();
      e.stopPropagation();
    };

    scrollEl.addEventListener("wheel", onWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", onWheel);
  }, [hasFixedHeight, localValue]);

  const highlight = useCallback((code: string) => highlightPromptVariables(code), []);

  const editorMinHeight = hasFixedHeight
    ? minHeight
    : fillScrollArea
      ? `max(${minHeight}, 100%)`
      : minHeight;

  const editor = (
    <div className="relative box-border w-full min-w-0 p-0 text-sm" style={{ minHeight: editorMinHeight }}>
      <Editor
        value={localValue}
        onValueChange={handleChange}
        highlight={highlight}
        padding={contentPadding}
        placeholder={placeholder}
        textareaClassName="prompt-editor-textarea focus:outline-none w-full"
        className={cn("prompt-editor-content", hasFixedHeight && "prompt-editor-scroll-host")}
        style={{ minHeight: editorMinHeight }}
      />
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-col rounded-md",
        fillScrollArea && "min-h-0",
        className,
      )}
    >
      {hasFixedHeight ? (
        <div
          ref={scrollRef}
          className="min-h-0 w-full min-w-0 shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md"
          style={{ height: maxHeight, maxHeight }}
        >
          {editor}
        </div>
      ) : (
        <ScrollArea className={cn("min-h-0 flex-1 overflow-hidden rounded-md", fillScrollArea && "h-full")}>
          {editor}
        </ScrollArea>
      )}
    </div>
  );
});

PromptEditor.displayName = "PromptEditor";
