/** Canned thinking-sound fillers. Must stay audio-only — never a transcript bubble.
 *
 * Mirrors THINKING_PHONES + THINKING_WORDS in
 * kupe-agents/agents/runtime/thinking_sounds.py; both vocabularies are spoken
 * depending on config.thinking_sounds.mode, so both must be hidden here. */

const THINKING_PHONES = new Set(
  [
    // mode: "sounds" — non-lexical hesitation
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
    // mode: "words" — short acknowledgement in the agent's language
    "okay",
    "got it",
    "right",
    "अच्छा",
    "ठीक है",
    "बराबर",
    "ठीक",
    "बरं",
    "ठीक आहे",
    "ठीक छ",
    "हुन्छ",
    "સારું",
    "ઠીક છે",
    "બરાબર",
    "আচ্ছা",
    "ঠিক আছে",
    "বুঝলাম",
    "ਅੱਛਾ",
    "ਠੀਕ ਹੈ",
    "ਸਹੀ",
    "ଆଚ୍ଛା",
    "ଠିକ ଅଛି",
    "ହଉ",
    "சரி",
    "புரிந்தது",
    "ஆமாம்",
    "సరే",
    "అలాగే",
    "అర్థమైంది",
    "ಸರಿ",
    "ಆಯ್ತು",
    "ಅರ್ಥವಾಯಿತು",
    "ശരി",
    "മനസ്സിലായി",
    "ഓകെ",
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
