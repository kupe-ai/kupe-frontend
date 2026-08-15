export type BlockType = "text" | "h1" | "h2" | "h3" | "bullet" | "todo" | "todo-done" | "quote";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
}

/** Parses a plain-text string (possibly written by the old textarea notes
 * field) into blocks, recognizing simple markdown-ish prefixes so existing
 * notes still render sensibly the first time someone opens the new editor. */
export function parseBlocks(source: string | null | undefined): Block[] {
  const lines = (source ?? "").split("\n");
  if (lines.length === 1 && lines[0] === "") {
    return [{ id: crypto.randomUUID(), type: "text", text: "" }];
  }
  return lines.map((line) => {
    const id = crypto.randomUUID();
    if (line.startsWith("### ")) return { id, type: "h3", text: line.slice(4) };
    if (line.startsWith("## ")) return { id, type: "h2", text: line.slice(3) };
    if (line.startsWith("# ")) return { id, type: "h1", text: line.slice(2) };
    if (line.startsWith("- ")) return { id, type: "bullet", text: line.slice(2) };
    if (line.startsWith("[x] ")) return { id, type: "todo-done", text: line.slice(4) };
    if (line.startsWith("[ ] ")) return { id, type: "todo", text: line.slice(4) };
    if (line.startsWith("> ")) return { id, type: "quote", text: line.slice(2) };
    return { id, type: "text", text: line };
  });
}

/** Serializes blocks back to the plain-text format persisted via the
 * existing `notes` fields — keeps this non-breaking with old data/API. */
export function serializeBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "h1": return `# ${b.text}`;
        case "h2": return `## ${b.text}`;
        case "h3": return `### ${b.text}`;
        case "bullet": return `- ${b.text}`;
        case "todo": return `[ ] ${b.text}`;
        case "todo-done": return `[x] ${b.text}`;
        case "quote": return `> ${b.text}`;
        default: return b.text;
      }
    })
    .join("\n");
}
