const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LONG_NUMBER = /\+?\d[\d\s().-]{8,}\d/g;
const SECRET =
  /\b(authorization|cookie|password|secret|token)\s*[:=]\s*[^,\r\n]+/gi;

export function sanitizeEventErrorMessage(
  value: string | undefined
): string | undefined {
  if (!value) return undefined;
  return value
    .replace(EMAIL, '[redacted-email]')
    .replace(LONG_NUMBER, '[redacted-number]')
    .replace(SECRET, '$1=[redacted]')
    .slice(0, 2_000);
}
