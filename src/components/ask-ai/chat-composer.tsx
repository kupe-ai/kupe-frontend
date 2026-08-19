"use client";

import { useRef } from "react";
import { ArrowUp, Paperclip, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttachedFile } from "@/lib/ask-ai/types";

export function AttachmentChips({
  files,
  onRemove,
}: {
  files: AttachedFile[];
  onRemove?: (id: string) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <span
          key={f.file_id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px]"
        >
          {f.filename}
          {f.row_count ? <span className="text-muted-foreground">· {f.row_count} rows</span> : null}
          {onRemove ? (
            <button type="button" onClick={() => onRemove(f.file_id)} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${f.filename}`}>
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function ComposerSubmitButton({
  sending,
  onSend,
  onStop,
  disabled,
  canSend,
  className,
  size = "icon-sm",
}: {
  sending?: boolean;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  canSend: boolean;
  className?: string;
  size?: "icon" | "icon-sm";
}) {
  if (sending) {
    return (
      <Button
        type="button"
        size={size}
        className={className}
        onClick={onStop}
        disabled={!onStop}
        aria-label="Stop generating"
      >
        <Square className="size-2.5 fill-current" />
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={onSend}
      disabled={!canSend || disabled}
      aria-label="Send"
    >
      <ArrowUp className="size-4" />
    </Button>
  );
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  placeholder,
  disabled,
  sending,
  attachments,
  onAttach,
  onRemoveAttachment,
  onNewConversation,
  rounded = "xl",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  placeholder: string;
  disabled?: boolean;
  sending?: boolean;
  attachments: AttachedFile[];
  onAttach?: (file: File) => void;
  onRemoveAttachment?: (id: string) => void;
  onNewConversation?: () => void;
  rounded?: "xl" | "full";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const round = rounded === "full" ? "rounded-full" : "rounded-2xl";

  return (
    <div className="space-y-2">
      <AttachmentChips files={attachments} onRemove={onRemoveAttachment} />
      <div className={cn("flex items-end gap-2 border border-border bg-muted/30 px-3 py-2", round)}>
        {onNewConversation ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mb-0.5 shrink-0 rounded-full"
            onClick={onNewConversation}
            disabled={disabled || sending}
            aria-label="Start a new conversation"
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
        {onAttach ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onAttach(file);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mb-0.5 shrink-0 rounded-full"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || sending}
              aria-label="Attach CSV"
            >
              <Paperclip className="size-4" />
            </Button>
          </>
        ) : null}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rounded === "full" ? 1 : 2}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="min-h-[40px] max-h-28 w-full resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <ComposerSubmitButton
          sending={sending}
          onSend={onSend}
          onStop={onStop}
          disabled={disabled}
          canSend={value.trim().length > 0 || attachments.length > 0}
          className="mb-0.5 shrink-0 rounded-full"
        />
      </div>
    </div>
  );
}

export function SuggestionChips({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="pressable rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
