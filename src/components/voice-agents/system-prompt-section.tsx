"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { PromptFieldCard } from "@/components/ui/prompt-field-card";
import { Separator } from "@/components/ui/separator";
import {
  DynamicGreetingSwitch,
  useDynamicGreeting,
} from "@/components/voice-agents/dynamic-greeting";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function PromptSectionHeader({
  title,
  description,
  animate,
}: {
  title: string;
  description: string;
  animate?: boolean;
}) {
  return (
    <div className="flex-none">
      <div className="flex items-center gap-1.5">
        <h3
          key={title}
          className={cn(
            "text-sm font-semibold tracking-tight",
            animate && "animate-greeting-swap",
          )}
        >
          {title}
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help">
              <Info className="size-4 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px]">
            {description}
          </TooltipContent>
        </Tooltip>
      </div>
      <Separator className="my-1.5 flex-none" />
      <p
        key={description}
        className={cn(
          "min-h-8 text-xs text-muted-foreground",
          animate && "animate-greeting-swap",
        )}
      >
        {description}
      </p>
    </div>
  );
}

export function SystemPromptSection({
  agentId,
  systemPrompt,
  firstMessage,
  onSystemPromptChange,
  onFirstMessageChange,
}: {
  agentId: string;
  systemPrompt: string;
  firstMessage: string;
  onSystemPromptChange: (value: string) => void;
  onFirstMessageChange: (value: string) => void;
}) {
  const dynamicGreeting = useDynamicGreeting(agentId);
  const dynamicOn = dynamicGreeting.config.enabled;
  const prevOn = useRef(false);
  const [flipGen, setFlipGen] = useState(0);
  const [shellPulse, setShellPulse] = useState(false);

  useEffect(() => {
    if (prevOn.current === dynamicOn) return;
    prevOn.current = dynamicOn;
    setFlipGen((n) => n + 1);
    setShellPulse(true);
  }, [dynamicOn]);

  const flipping = flipGen > 0;

  return (
    <div className="flex h-full flex-col px-6 py-6 md:px-10 lg:px-12">
      <div className="flex min-h-full flex-col gap-6 pb-2">
        <div className="shrink-0 space-y-2">
          <PromptSectionHeader
            title="System prompt"
            description="Define your agent's personality, knowledge, tone, and goals. Use markdown headers like # Personality to structure longer prompts."
          />
          <PromptFieldCard
            value={systemPrompt}
            onChange={onSystemPromptChange}
            placeholder="You are a helpful AI assistant..."
            expandTitle="System prompt"
            minHeight="300px"
            maxHeight="300px"
          />
        </div>

        <div className="shrink-0 space-y-2">
          <PromptSectionHeader
            title={dynamicOn ? "Greeting guidance" : "First message"}
            description={
              dynamicOn
                ? "The first prompt the agent gets when it joins. If empty, it is asked to start the conversation."
                : "The first message the agent will say. If empty, the agent will wait for the user to start the conversation."
            }
            animate={flipping}
          />
          <div
            className={cn("rounded-lg", shellPulse && "animate-greeting-shell")}
            onAnimationEnd={() => setShellPulse(false)}
          >
            <PromptFieldCard
              value={dynamicOn ? dynamicGreeting.config.instructions : firstMessage}
              onChange={dynamicOn ? dynamicGreeting.setInstructions : onFirstMessageChange}
              placeholder={
                dynamicOn
                  ? "e.g. If they have an unpaid invoice, mention the due date before anything else."
                  : "Hey, this is Jamie from support — what can I help you with today?"
              }
              expandTitle={dynamicOn ? "Greeting guidance" : "First message"}
              minHeight="60px"
              maxHeight="120px"
              footerTrailing={<DynamicGreetingSwitch {...dynamicGreeting} />}
              swapKey={flipping ? (dynamicOn ? "guidance" : "first") : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
