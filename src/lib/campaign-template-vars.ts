import { extractVariableNames } from "@/lib/prompt-variables";
import type { Agent } from "@/types";

/** Required contact variable keys for an agent — mirrors backend batch_templating.required_variable_names. */
export function requiredVariablesForAgent(
  agent: Pick<Agent, "system_prompt" | "greeting" | "config" | "flow_definition"> | null | undefined,
): string[] {
  if (!agent) return [];
  const flowTexts: string[] = [];
  for (const node of Object.values(agent.flow_definition?.nodes ?? {})) {
    if (!node || typeof node !== "object") continue;
    if (typeof node.role_message === "string") flowTexts.push(node.role_message);
    for (const message of node.task_messages ?? []) {
      if (typeof message === "string") flowTexts.push(message);
      else if (message && typeof message.content === "string") flowTexts.push(message.content);
    }
  }
  const declared = (agent.config?.variables ?? [])
    .map((v) => (v?.key || "").trim())
    .filter(Boolean);
  const vm = agent.config?.voicemail_detection?.message;
  const fromTemplates = extractVariableNames(
    agent.system_prompt,
    agent.greeting,
    typeof vm === "string" ? vm : null,
    ...flowTexts,
  );
  return [...new Set([...declared, ...fromTemplates])].sort();
}

/** Keys required by the agent that are absent from a contact's variables object. */
export function missingVariablesForContact(
  required: string[],
  variables: Record<string, unknown> | null | undefined,
): string[] {
  const vars = variables ?? {};
  return required.filter((k) => !(k in vars));
}

/** Columns (excluding phone) that are still required for a new recipient list. */
export function missingColumnsForRecipients(required: string[], columns: string[]): string[] {
  const have = new Set(columns);
  return required.filter((k) => !have.has(k));
}

export function formatMissingVarsMessage(missing: string[], opts?: { phone?: string; more?: number }): string {
  const list = missing.map((k) => `{{${k}}}`).join(", ");
  if (opts?.phone) {
    const more =
      opts.more && opts.more > 0
        ? ` (+${opts.more} more recipient${opts.more === 1 ? "" : "s"})`
        : "";
    return `Can't start — ${opts.phone} is missing ${list}${more}. Add these columns to your recipients and try again.`;
  }
  return `This agent needs ${list} on every recipient. Add those columns (CSV or manually) before launch.`;
}
