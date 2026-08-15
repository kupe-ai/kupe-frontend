export type CallLanguage = {
  code: string;
  name: string;
  native_name: string;
};

/** English + India's 22 scheduled languages. Used if the API omits `languages`. */
export const CALL_LANGUAGES: CallLanguage[] = [
  { code: "en", name: "English", native_name: "English" },
  { code: "hi", name: "Hindi", native_name: "हिन्दी" },
  { code: "bn", name: "Bengali", native_name: "বাংলা" },
  { code: "te", name: "Telugu", native_name: "తెలుగు" },
  { code: "mr", name: "Marathi", native_name: "मराठी" },
  { code: "ta", name: "Tamil", native_name: "தமிழ்" },
  { code: "gu", name: "Gujarati", native_name: "ગુજરાતી" },
  { code: "ur", name: "Urdu", native_name: "اردو" },
  { code: "kn", name: "Kannada", native_name: "ಕನ್ನಡ" },
  { code: "or", name: "Odia", native_name: "ଓଡ଼ିଆ" },
  { code: "ml", name: "Malayalam", native_name: "മലയാളം" },
  { code: "pa", name: "Punjabi", native_name: "ਪੰਜਾਬੀ" },
  { code: "as", name: "Assamese", native_name: "অসমীয়া" },
  { code: "mai", name: "Maithili", native_name: "मैथिली" },
  { code: "sat", name: "Santali", native_name: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "ks", name: "Kashmiri", native_name: "कॉशुर" },
  { code: "ne", name: "Nepali", native_name: "नेपाली" },
  { code: "kok", name: "Konkani", native_name: "कोंकणी" },
  { code: "sd", name: "Sindhi", native_name: "سنڌي" },
  { code: "doi", name: "Dogri", native_name: "डोगरी" },
  { code: "mni", name: "Manipuri", native_name: "মৈতৈলোন্" },
  { code: "brx", name: "Bodo", native_name: "बर'" },
  { code: "sa", name: "Sanskrit", native_name: "संस्कृतम्" },
];

export function languageLabel(code: string, languages: CallLanguage[] = CALL_LANGUAGES): string {
  const row = languages.find((l) => l.code === code);
  if (!row) return code;
  return row.native_name && row.native_name !== row.name
    ? `${row.name} (${row.native_name})`
    : row.name;
}
