export function isMac(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Macintosh|Mac OS X/.test(userAgent);
}

const SYMBOL_MAP: Record<string, string> = {
  "⌘": "Ctrl",
  "⇧": "Shift",
  "⌥": "Alt",
  "⌃": "Ctrl",
  "↵": "Enter",
  "⌫": "Backspace",
};

/**
 * Returns a platform-appropriate shortcut label.
 * E.g., getShortcutLabel("⌘⇧T")
 * - On macOS: "⌘⇧T"
 * - On Windows/Linux: "Ctrl+Shift+T"
 */
export function getShortcutLabel(shortcut: string): string {
  if (!shortcut) return "";
  if (isMac()) {
    return shortcut;
  }

  const modifiers: string[] = [];
  let remaining = shortcut;

  // Extract modifier symbols from the start of the string
  while (remaining.length > 0) {
    const char = remaining[0];
    if (char in SYMBOL_MAP && char !== "↵" && char !== "⌫") {
      modifiers.push(SYMBOL_MAP[char]);
      remaining = remaining.slice(1);
    } else {
      break;
    }
  }

  // Now convert the remaining key/action if it's a known symbol
  let key = remaining;
  if (key in SYMBOL_MAP) {
    key = SYMBOL_MAP[key];
  }

  if (modifiers.length > 0) {
    return [...modifiers, key].join("+");
  }

  return key;
}
