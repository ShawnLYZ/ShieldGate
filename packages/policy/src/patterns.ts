// Shared regex sources consumed by BOTH the extension (local layer) and the
// backend (authoritative layer). Luhn validation is code, implemented on each
// side; `validator: "luhn"` marks candidates that require it.
export interface PatternDef {
  type: "card" | "my_ic" | "passport" | "api_key" | "email" | "phone";
  source: string;
  flags: string;
  category: "restricted";
  validator?: "luhn";
  label: string; // plain-language noun used in block reasons
}

export const PATTERN_DEFS: PatternDef[] = [
  { type: "card", source: String.raw`\b(?:\d[ -]?){13,19}\b`, flags: "g",
    category: "restricted", validator: "luhn", label: "a payment card number" },
  { type: "my_ic", source: String.raw`\b\d{6}-\d{2}-\d{4}\b`, flags: "g",
    category: "restricted", label: "a Malaysian IC number" },
  { type: "passport", source: String.raw`\b[A-Z]{1,2}\d{7,8}\b`, flags: "g",
    category: "restricted", label: "a passport number" },
  { type: "api_key",
    source: String.raw`(sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)`,
    flags: "g", category: "restricted", label: "an API key or credential" },
  { type: "email", source: String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
    flags: "g", category: "restricted", label: "an email address" },
  { type: "phone", source: String.raw`(?:\+?6?01\d[-\s]?\d{3}[-\s]?\d{4}|\+\d{9,14})`,
    flags: "g", category: "restricted", label: "a phone number" },
];
