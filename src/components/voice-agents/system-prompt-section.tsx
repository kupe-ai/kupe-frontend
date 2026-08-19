"use client";

import { Info } from "lucide-react";
import { PromptFieldCard } from "@/components/ui/prompt-field-card";
import { Separator } from "@/components/ui/separator";
import {
  DynamicGreetingInstructions,
  DynamicGreetingSwitch,
  useDynamicGreeting,
} from "@/components/voice-agents/dynamic-greeting";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function PromptSectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex-none">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
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
      <p className="text-xs text-muted-foreground">{description}</p>
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
            title="First message"
            description="The first message the agent will say. If empty, the agent will wait for the user to start the conversation."
          />
          <PromptFieldCard
            value={firstMessage}
            onChange={onFirstMessageChange}
            placeholder="Hey, this is Jamie from support — what can I help you with today?"
            expandTitle="First message"
            minHeight="60px"
            maxHeight="120px"
            footerTrailing={<DynamicGreetingSwitch {...dynamicGreeting} />}
          />
          <DynamicGreetingInstructions {...dynamicGreeting} />
        </div>
      </div>
    </div>
  );
}
