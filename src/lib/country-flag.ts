/** Regional-indicator emoji for an ISO 3166-1 alpha-2 country code. */
export function countryFlag(iso: string | null | undefined): string {
  const code = (iso ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

export function flagForNumber(number: string, countryIso?: string | null): string {
  const fromIso = countryFlag(countryIso);
  if (fromIso) return fromIso;
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("91")) return countryFlag("IN");
  if (digits.startsWith("1") && digits.length >= 11) return countryFlag("US");
  return "";
}
