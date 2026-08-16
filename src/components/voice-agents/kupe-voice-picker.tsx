"use client";

import * as React from "react";
import { ChevronsUpDown, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { AudioPreviewProvider, useAudioPreview } from "@/lib/hooks/use-audio-preview";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Matrix, seededPattern } from "@/components/ui/matrix";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CatalogVoice } from "@/types";

/**
 * Voice Picker, ported from the ElevenLabs UI registry's `voice-picker` to
 * work with Kupe's own multi-provider `CatalogVoice` catalog instead of the
 * ElevenLabs SDK's `ElevenLabs.Voice` type. Also swaps the registry's
 * three.js-based `Orb` for a seeded static Matrix identicon, and its
 * full-featured `audio-player` for a small shared preview-only player —
 * keeps this searchable, preview-able picker without pulling in a WebGL
 * renderer or a scrubber/volume UI just for a play button.
 */

interface KupeVoicePickerProps {
  voices: CatalogVoice[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function KupeVoicePicker(props: KupeVoicePickerProps) {
  return (
    <AudioPreviewProvider>
      <KupeVoicePickerInner {...props} />
    </AudioPreviewProvider>
  );
}

function KupeVoicePickerInner({
  voices,
  value,
  onValueChange,
  placeholder = "Select a voice…",
  className,
  open,
  onOpenChange,
  disabled,
}: KupeVoicePickerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  const selectedVoice = voices.find((v) => v.voice_id === value);

  return (
    <Popover open={disabled ? false : isOpen} onOpenChange={disabled ? undefined : setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          disabled={disabled}
          className={cn("h-9 w-72 justify-between rounded-full font-normal", className)}
        >
          {selectedVoice ? (
            <span className="flex min-w-0 items-center gap-2">
              <VoiceOrb seed={selectedVoice.id} />
              <span className="truncate">{selectedVoice.voice_name || selectedVoice.voice_id}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search voices…" />
          <CommandList>
            <CommandEmpty>No voice found.</CommandEmpty>
            <CommandGroup>
              {voices.map((voice) => (
                <VoicePickerItem
                  key={voice.id}
                  voice={voice}
                  isSelected={value === voice.voice_id}
                  onSelect={() => onValueChange?.(voice.voice_id)}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function VoiceOrb({ seed }: { seed: string }) {
  const pattern = React.useMemo(() => seededPattern(seed), [seed]);
  return (
    <span className="relative inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
      <Matrix
        rows={7}
        cols={7}
        pattern={pattern}
        size={2.4}
        gap={0.6}
        palette={{ on: "var(--primary)", off: "transparent" }}
        ariaLabel=""
      />
    </span>
  );
}

function VoicePickerItem({
  voice,
  isSelected,
  onSelect,
}: {
  voice: CatalogVoice;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const player = useAudioPreview();

  const preview = voice.preview_url;
  const isPlaying = Boolean(preview) && player.isItemActive(voice.id) && player.isPlaying;

  const handlePreview = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!preview) return;
      if (isPlaying) player.pause();
      else player.play(voice.id, preview);
    },
    [preview, isPlaying, player, voice.id],
  );

  const meta = [voice.gender, ...voice.supported_languages.slice(0, 2)].filter(Boolean);

  return (
    <CommandItem
      value={`${voice.voice_name} ${voice.voice_id}`}
      keywords={[voice.voice_name, voice.gender ?? "", ...voice.supported_languages].filter(Boolean)}
      data-checked={isSelected}
      onSelect={onSelect}
      className="flex items-center gap-3"
    >
      <span
        className="relative z-10 flex size-8 shrink-0 cursor-pointer items-center justify-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handlePreview}
      >
        <VoiceOrb seed={voice.id} />
        {preview && isHovered && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            {isPlaying ? (
              <Pause className="size-3 text-white" />
            ) : (
              <Play className="size-3 text-white" />
            )}
          </span>
        )}
      </span>

      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium text-foreground">
          {voice.voice_name || voice.voice_id}
        </span>
        {meta.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {meta.map((m, i) => (
              <React.Fragment key={m}>
                {i > 0 && <span>·</span>}
                <span className="capitalize">{m}</span>
              </React.Fragment>
            ))}
          </span>
        )}
      </span>
    </CommandItem>
  );
}
