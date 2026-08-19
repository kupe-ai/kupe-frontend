/** Strip leaked LLM tool-call token fences from live transcripts. */

const TOOL_FENCE =
  /<\|\/?tool_call\|>|<\|tool_calls_section_(?:begin|end)\|>|<\|tool_call_(?:begin|argument_begin|argument_end|end)\|>/gi;
const NAKED_CALL = /(?:_call:)?\s*(?:EndCallTool|end_call|transfer_call)\s*\{[^}]*\}/gi;
const XMLISH = /<\/?tool_call>/gi;

export function stripToolCallMarkup(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(TOOL_FENCE, " ")
    .replace(NAKED_CALL, " ")
    .replace(XMLISH, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isToolCallMarkup(text: string | null | undefined): boolean {
  const raw = (text || "").trim();
  if (!raw) return false;
  return !stripToolCallMarkup(raw);
}
