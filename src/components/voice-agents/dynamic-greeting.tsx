"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getDynamicGreetingConfig,
  updateDynamicGreetingConfig,
} from "@/lib/api/voice/agent-builder";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { captureEvent } from "@/lib/posthog";
import type { DynamicGreetingConfig } from "@/types";

const SAVE_DEBOUNCE_MS = 600;

export type DynamicGreetingState = {
  config: DynamicGreetingConfig | null;
  setEnabled: (enabled: boolean) => void;
  setInstructions: (instructions: string) => void;
};

/**
 * The First message field's own on/off switch. Off, the agent speaks that
 * field verbatim; on, it writes the opening line per call from the same
 * prompt and recalled caller memory, using the field as the style reference
 * and the fallback.
 *
 * Lives outside the editor page's prompt autosave because it writes
 * `config.dynamic_greeting`, not `greeting` — flipping the switch must not
 * push a prompt revision, and typing in the prompt must not push a config
 * one. Toggles save immediately (a switch should feel committed); guidance
 * text is debounced like every other free-text field in the builder.
 */
export function useDynamicGreeting(agentId: string): DynamicGreetingState {
  const [config, setConfig] = useState<DynamicGreetingConfig | null>(null);
  const configRef = useRef<DynamicGreetingConfig | null>(null);
  configRef.current = config;
  const savedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: DynamicGreetingConfig) => {
      const serialized = JSON.stringify(next);
      if (serialized === savedRef.current) return;
      savedRef.current = serialized;
      try {
        await updateDynamicGreetingConfig(agentId, next);
      } catch (err) {
        savedRef.current = "";
        toast.error(friendlyVoiceError(err, "Couldn't save greeting settings"));
      }
    },
    [agentId],
  );

  useEffect(() => {
    let active = true;
    void getDynamicGreetingConfig(agentId)
      .then((loaded) => {
        if (!active) return;
        savedRef.current = JSON.stringify(loaded);
        setConfig(loaded);
      })
      .catch((err) => {
        if (active) toast.error(friendlyVoiceError(err, "Couldn't load greeting settings"));
      });
    return () => {
      active = false;
    };
  }, [agentId]);

  // Flush a pending guidance edit if the section unmounts before the debounce
  // fires, so switching tabs mid-sentence doesn't drop it.
  useEffect(() => {
    return () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      const latest = configRef.current;
      if (latest) void persist(latest);
    };
  }, [persist]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const next = { ...(configRef.current ?? { instructions: "" }), enabled };
      setConfig(next);
      captureEvent("dynamic_greeting_toggled", { agent_id: agentId, enabled });
      void persist(next);
    },
    [agentId, persist],
  );

  const setInstructions = useCallback(
    (instructions: string) => {
      const next = { ...(configRef.current ?? { enabled: true }), instructions };
      setConfig(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  return { config, setEnabled, setInstructions };
}

/** Renders into the First message card footer, opposite the `{{` hint. */
export function DynamicGreetingSwitch({ config, setEnabled }: DynamicGreetingState) {
  if (!config) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Deliberately not a <label>: Radix renders the Switch as a button,
            which a wrapping label would toggle a second time. */}
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src="/brand/kupe-mark.png"
            alt=""
            width={14}
            height={14}
            className="size-3.5 shrink-0 rounded-[3px] object-contain"
            draggable={false}
            aria-hidden
          />
          <span className="whitespace-nowrap">Dynamic</span>
          <Switch
            size="sm"
            checked={config.enabled}
            onCheckedChange={setEnabled}
            aria-label="Generate the first message from context on every call"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        {config.enabled
          ? "The agent writes its opening line each call from this field's tone plus what it remembers about the caller. This text is the fallback if generation is too slow."
          : "The agent says this message word for word. Turn on to have it write the opening line per call from the caller's context instead."}
      </TooltipContent>
    </Tooltip>
  );
}

/** Optional author steering, revealed under the field once the switch is on. */
export function DynamicGreetingInstructions({ config, setInstructions }: DynamicGreetingState) {
  if (!config?.enabled) return null;
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
      <label
        htmlFor="dynamic-greeting-instructions"
        className="text-xs font-medium text-foreground"
      >
        Greeting guidance <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id="dynamic-greeting-instructions"
        value={config.instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="e.g. If they have an unpaid invoice, mention the due date before anything else."
        className="resize-y bg-background text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Steers only the opening line. Everything after it follows the system prompt.
      </p>
    </div>
  );
}
