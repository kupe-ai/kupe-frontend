"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RenameDialog({
  open,
  onOpenChange,
  title = "Rename",
  label = "Name",
  initial = "",
  submitting = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  label?: string;
  initial?: string;
  submitting?: boolean;
  onSubmit: (name: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next) return;
    await onSubmit(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <form onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2">
            <Label htmlFor="rename-value">{label}</Label>
            <Input
              id="rename-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="h-10 rounded-xl"
            />
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
