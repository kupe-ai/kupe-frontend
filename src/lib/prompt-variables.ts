/** VIBGYOR chip colors — one hue per unique `{{variable}}`, in first-seen order. */
export const VIBGYOR = [
  { name: "violet", text: "rgb(124, 58, 237)", bg: "rgba(124, 58, 237, 0.12)", border: "rgba(124, 58, 237, 0.22)" },
  { name: "indigo", text: "rgb(79, 70, 229)", bg: "rgba(79, 70, 229, 0.12)", border: "rgba(79, 70, 229, 0.22)" },
  { name: "blue", text: "rgb(37, 99, 235)", bg: "rgba(37, 99, 235, 0.12)", border: "rgba(37, 99, 235, 0.22)" },
  { name: "green", text: "rgb(22, 163, 74)", bg: "rgba(22, 163, 74, 0.12)", border: "rgba(22, 163, 74, 0.22)" },
  { name: "yellow", text: "rgb(202, 138, 4)", bg: "rgba(250, 204, 21, 0.22)", border: "rgba(202, 138, 4, 0.28)" },
  { name: "orange", text: "rgb(234, 88, 12)", bg: "rgba(234, 88, 12, 0.12)", border: "rgba(234, 88, 12, 0.22)" },
  { name: "red", text: "rgb(220, 38, 38)", bg: "rgba(220, 38, 38, 0.12)", border: "rgba(220, 38, 38, 0.22)" },
] as const;

export type VibgyorSwatch = (typeof VIBGYOR)[number];

export function vibgyorAt(index: number): VibgyorSwatch {
  const n = VIBGYOR.length;
  return VIBGYOR[((index % n) + n) % n];
}

export function vibgyorChipStyle(index: number): {
  backgroundColor: string;
  color: string;
  boxShadow: string;
} {
  const c = vibgyorAt(index);
  return {
    backgroundColor: c.bg,
    color: c.text,
    boxShadow: `inset 0 0 0 1px ${c.border}`,
  };
}

const VARIABLE_RE = /\{\{([^{}]+)\}\}/g;

export function vibgyorMapForText(text: string): Map<string, VibgyorSwatch> {
  const map = new Map<string, VibgyorSwatch>();
  const re = new RegExp(VARIABLE_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const name = match[1].trim();
    if (name && !map.has(name)) {
      map.set(name, vibgyorAt(map.size));
    }
  }
  return map;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function highlightPromptVariables(code: string): string {
  const colors = vibgyorMapForText(code);
  const parts: string[] = [];
  const re = new RegExp(VARIABLE_RE.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code))) {
    parts.push(escapeHtml(code.slice(last, match.index)));
    const raw = match[1];
    const swatch = colors.get(raw.trim()) ?? VIBGYOR[0];
    parts.push(
      `<span class="prompt-variable-token" style="background-color:${swatch.bg};color:${swatch.text};box-shadow:inset 0 0 0 1px ${swatch.border}">{{${escapeHtml(raw)}}}</span>`,
    );
    last = match.index + match[0].length;
  }
  parts.push(escapeHtml(code.slice(last)));
  return parts.join("");
}
