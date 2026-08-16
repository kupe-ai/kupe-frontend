"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string;
  hint?: string;
  icon?: ReactNode;
};

function OptionRow({ option }: { option: SearchableOption }) {
  return (
    <>
      {option.icon}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
    </>
  );
}

const itemClassName =
  "bg-transparent data-selected:bg-transparent data-[selected=true]:bg-transparent hover:bg-muted data-[selected=true]:hover:bg-muted";

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-72 justify-between rounded-full font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2 text-left">
            {selected?.icon}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.keywords ?? ""} ${option.value}`}
                  data-checked={option.value === value}
                  className={itemClassName}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <OptionRow option={option} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SearchableMultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled,
  className,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.filter((o) => values.includes(o.value)),
    [options, values],
  );

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  return (
    <div className={cn("flex max-w-md flex-col items-end gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-9 w-72 justify-between rounded-full font-normal"
          >
            <span className="truncate text-left">
              {selected.length ? `${selected.length} selected` : placeholder}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.keywords ?? ""} ${option.value}`}
                    data-checked={values.includes(option.value)}
                    className={itemClassName}
                    onSelect={() => toggle(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-1">
          {selected.map((option) => (
            <Badge
              key={option.value}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
