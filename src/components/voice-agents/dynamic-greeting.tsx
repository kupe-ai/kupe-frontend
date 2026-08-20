"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import type { DynamicGreetingConfig } from "@/types";

const SAVE_DEBOUNCE_MS = 600;

export type DynamicGreetingState = {
  config: DynamicGreetingConfig;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  setInstructions: (instructions: string) => void;
};

const DEFAULT_CONFIG: DynamicGreetingConfig = { enabled: false, instructions: "" };

/**
 * The greeting card's own on/off switch. Off, the card is the first message
 * spoken verbatim. On, the same card is greeting guidance — the first prompt
 * the agent gets when it joins (or "start the conversation" if empty).
 *
 * Lives outside the editor page's prompt autosave because it writes
 * `config.dynamic_greeting`, not `greeting` — flipping the switch must not
 * push a prompt revision, and typing in the prompt must not push a config
 * one. Toggles save immediately (a switch should feel committed); guidance
 * text is debounced like every other free-text field in the builder.
 *
 * Until the agent config is fetched the switch is shown off. If the saved
 * value is on, it then flips — so the control is on screen immediately.
 */
export function useDynamicGreeting(agentId: string): DynamicGreetingState {
  const [config, setConfig] = useState<DynamicGreetingConfig>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const configRef = useRef<DynamicGreetingConfig>(config);
  configRef.current = config;
  const hydratedRef = useRef(false);
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
    setHydrated(false);
    hydratedRef.current = false;
    setConfig(DEFAULT_CONFIG);
    void getDynamicGreetingConfig(agentId)
      .then((loaded) => {
        if (!active) return;
        savedRef.current = JSON.stringify(loaded);
        setConfig(loaded);
        hydratedRef.current = true;
        setHydrated(true);
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
      if (!hydratedRef.current) return;
      const latest = configRef.current;
      if (latest) void persist(latest);
    };
  }, [persist]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (!hydratedRef.current) return;
      const next = { ...configRef.current, enabled };
      setConfig(next);
      captureEvent("dynamic_greeting_toggled", { agent_id: agentId, enabled });
      void persist(next);
    },
    [agentId, persist],
  );

  const setInstructions = useCallback(
    (instructions: string) => {
      if (!hydratedRef.current) return;
      const next = { ...configRef.current, instructions };
      setConfig(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  return { config, hydrated, setEnabled, setInstructions };
}

/** Renders into the greeting card footer, opposite the `{{` hint. */
export function DynamicGreetingSwitch({ config, hydrated, setEnabled }: DynamicGreetingState) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Deliberately not a <label>: Radix renders the Switch as a button,
            which a wrapping label would toggle a second time. */}
        <span
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            !hydrated && "pointer-events-none",
          )}
        >
          <img
            src="/brand/kupe-mark.png"
            alt=""
            width={14}
            height={14}
            className="size-3.5 shrink-0 rounded-[3px] object-contain"
            draggable={false}
            aria-hidden
          />
          <span
            className={cn(
              "whitespace-nowrap transition-colors duration-300",
              config.enabled && "text-foreground",
            )}
          >
            Dynamic
          </span>
          <Switch
            size="sm"
            checked={config.enabled}
            onCheckedChange={setEnabled}
            aria-busy={!hydrated}
            aria-label="Write the opening line from context on every call"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        {config.enabled
          ? "When the agent joins it is prompted with this guidance and speaks the reply. The first message is ignored."
          : "The agent says the first message word for word as soon as it joins. Turn on to prompt it instead — empty guidance means “start the conversation.”"}
      </TooltipContent>
    </Tooltip>
  );
}
