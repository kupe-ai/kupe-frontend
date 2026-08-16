"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { highlightPromptVariables } from "@/lib/prompt-variables";

export function PromptEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "150px",
  maxHeight,
  contentPadding = 12,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  contentPadding?: number | string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const capped = Boolean(maxHeight);
  const padding = typeof contentPadding === "number" ? `${contentPadding}px` : contentPadding;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (next: string) => {
      setLocalValue(next);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => onChange(next), 300);
    },
    [onChange],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  function syncScroll() {
    if (!preRef.current || !taRef.current) return;
    preRef.current.scrollTop = taRef.current.scrollTop;
    preRef.current.scrollLeft = taRef.current.scrollLeft;
  }

  const html = highlightPromptVariables(localValue);

  return (
    <div
      className={cn("relative w-full min-w-0", className)}
      style={{
        minHeight,
        height: capped ? maxHeight : undefined,
        maxHeight,
      }}
    >
      <pre
        ref={preRef}
        aria-hidden
        className={cn("prompt-editor-pre", capped && "absolute inset-0 overflow-hidden")}
        style={{ padding, minHeight: capped ? undefined : minHeight }}
        dangerouslySetInnerHTML={{ __html: `${html || "&nbsp;"}\n` }}
      />
      <textarea
        ref={taRef}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          "prompt-editor-textarea",
          capped ? "overflow-auto" : "overflow-hidden",
        )}
        style={{ padding }}
      />
    </div>
  );
}
