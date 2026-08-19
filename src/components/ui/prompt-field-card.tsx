"use client";

import { useState, type ReactNode } from "react";
import { Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { PromptEditor } from "@/components/ui/prompt-editor";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function PromptVariablesFooter({
  className,
  trailing,
}: {
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-input bg-muted px-3 py-2",
        className,
      )}
    >
      <p className="min-w-0 text-xs text-muted-foreground">
        Type{" "}
        <span className="inline-flex items-center rounded border border-input bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium leading-4 text-foreground">
          {"{{"}
        </span>{" "}
        to add variables
      </p>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

export function PromptFieldCard({
  value,
  onChange,
  placeholder,
  expandTitle,
  minHeight = "150px",
  maxHeight,
  footerTrailing,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  expandTitle: string;
  minHeight?: string;
  maxHeight?: string;
  /** Right-hand side of the footer, opposite the `{{` hint — for a control
   * that belongs to this field rather than to the page. */
  footerTrailing?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const editorClassName = "w-full rounded-none border-0 bg-transparent shadow-none";

  function renderEditor(fullScreen: boolean) {
    return (
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overscroll-contain px-2 pt-3 pb-2">
        <PromptEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(editorClassName, fullScreen && "field-focus-container-static h-full")}
          minHeight={fullScreen ? "100%" : minHeight}
          maxHeight={fullScreen ? "100%" : maxHeight}
          contentPadding="10px 40px 14px 14px"
        />
      </div>
    );
  }

  return (
    <>
      <div className="field-focus-container group relative flex flex-col overflow-hidden rounded-lg bg-background dark:bg-card">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Expand ${expandTitle.toLowerCase()}`}
          className={cn(
            "absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-md",
            "border border-input bg-background text-muted-foreground shadow-xs",
            "opacity-70 transition-all duration-150 group-hover:opacity-100",
            "hover:border-border hover:bg-muted hover:text-foreground",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          <Expand className="size-4" strokeWidth={1.75} />
        </button>

        {renderEditor(false)}
        <PromptVariablesFooter trailing={footerTrailing} />
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          className={cn(
            "flex h-[min(88vh,820px)] max-h-[min(88vh,820px)] w-[min(96vw,920px)] flex-col gap-0 overflow-hidden p-0",
            "field-focus-container field-focus-container-static rounded-xl bg-background sm:max-w-[min(96vw,920px)] dark:bg-card",
          )}
        >
          <DialogTitle className="border-b border-input px-5 py-4 text-base font-semibold text-foreground">
            {expandTitle}
          </DialogTitle>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {renderEditor(true)}
            <PromptVariablesFooter trailing={footerTrailing} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
