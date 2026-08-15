/** Tiny localStorage JSON store for Voice Agents surfaces Kupe doesn't have APIs for yet. */

export function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

export function scopedKey(base: string, extra = "") {
  return `kupe:voice:${base}${extra ? `:${extra}` : ""}`;
}
