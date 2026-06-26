const BUMPA_CONTACT_EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BUMPA_NIGERIAN_PHONE_PATTERN =
  /(^|[^\d])(?:\+?234[\s.-]*[789]\d(?:[\s.-]*\d){8}|0[789]\d(?:[\s.-]*\d){8})\b/g;

interface BumpaContactTextReplacements {
  email: string;
  phone: string;
}

export function replaceBumpaContactText(
  value: string,
  replacements: BumpaContactTextReplacements
) {
  return value
    .replace(BUMPA_CONTACT_EMAIL_PATTERN, () => replacements.email)
    .replace(
      BUMPA_NIGERIAN_PHONE_PATTERN,
      (_match, prefix: string) => `${prefix}${replacements.phone}`
    );
}
