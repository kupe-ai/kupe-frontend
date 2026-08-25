/** Canned thinking-sound fillers. Must stay audio-only — never a transcript bubble.
 *
 * Mirrors THINKING_PHONES + THINKING_WORDS + ThinkSpark seed lexicon in
 * kupe-agents/agents/runtime/thinking_sounds.py. Auto mode speaks dictionary
 * voices (often with a trailing ellipsis: `हम्म...`) that must stay hidden too. */

const THINKING_PHONES = new Set(
  [
    // mode: "sounds" — non-lexical hesitation
    "hmm",
    "umm",
    "uh",
    "हम्म",
    "अं",
    "उम्म",
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
    // mode: "words" + ThinkSpark seed voices — short acknowledgements
    "okay",
    "got it",
    "right",
    "yeah",
    "one sec",
    "let me see",
    "gotcha",
    "अच्छा",
    "ठीक है",
    "बराबर",
    "ठीक",
    "हाँ",
    "बिल्कुल",
    "देखिए",
    "एक सेकंड",
    "रुकिए ज़रा",
    "हाँ हाँ",
    "बरं",
    "ठीक आहे",
    "हो",
    "ठीक छ",
    "हुन्छ",
    "સારું",
    "ઠીક છે",
    "બરાબર",
    "હા",
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
    "ஒரு நிமிடம்",
    "సరే",
    "అలాగే",
    "అర్థమైంది",
    "ಸರಿ",
    "ಆಯ್ತು",
    "ಅರ್ಥವಾಯಿತು",
    "ശരി",
    "മനസ്സിലായി",
    "ഓകെ",
    "achha",
    "theek hai",
    "haan",
    "ek second",
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
  return (text ?? "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.…。!?]+$/g, "");
}
