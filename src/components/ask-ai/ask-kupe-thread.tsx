"use client";

import { Message, MessageContent } from "@/components/ui/message";
import { AgentSteps, WorkingShimmer } from "@/components/ask-ai/agent-steps";
import { MarkdownMessage } from "@/components/ask-ai/markdown-message";
import { sanitizeChatError } from "@/lib/ask-ai/public-error";
import type { ChatTurn } from "@/lib/ask-ai/types";

export function AskKupeTurn({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <Message from="user">
        <MessageContent>{turn.text}</MessageContent>
      </Message>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {turn.steps.length > 0 ? <AgentSteps steps={turn.steps} streaming={turn.streaming} /> : null}
      {turn.text ? (
        <Message from="assistant">
          <MessageContent variant="flat">
            <MarkdownMessage text={turn.text} />
          </MessageContent>
        </Message>
      ) : turn.streaming && turn.steps.length === 0 ? (
        <WorkingShimmer label={turn.status || "Kupe is working…"} />
      ) : null}
      {turn.error ? <p className="text-xs text-destructive">{sanitizeChatError(turn.error)}</p> : null}
    </div>
  );
}
