/** Canned thinking-sound fillers. Must stay audio-only — never a transcript bubble. */

const THINKING_PHONES = new Set(
  [
    "hmm",
    "umm",
    "हम्म",
    "अं",
    "હમ્મ",
    "અમ",
    "হুম",
    "উম",
    "ਹਮ",
    "ਉਮ",
    "ହମ୍",
    "ଉମ୍",
    "ம்ம்",
    "உம்",
    "హ్మ్",
    "ఉమ్",
    "ಹ್ಮ್",
    "ಉಂ",
    "ഹ്ം",
    "ഉം",
    "ہمم",
    "ام",
  ].map((phone) => phone.normalize("NFC").trim().toLocaleLowerCase()),
);

export function isThinkingPhone(text: string | null | undefined): boolean {
  const compact = thinkingCompact(text);
  if (!compact) return false;
  if (THINKING_PHONES.has(compact)) return true;
  for (const phone of THINKING_PHONES) {
    if (phone.startsWith(compact) || compact === phone) return true;
  }
  return false;
}

function thinkingCompact(text: string | null | undefined): string {
  return (text ?? "").normalize("NFC").trim().toLocaleLowerCase().replace(/\s+/g, "");
}
