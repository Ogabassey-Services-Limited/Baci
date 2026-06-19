const REDACTED_VALUE = '[Filtered]';
const EXCEPTION_EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EXCEPTION_LONG_NUMBER_PATTERN = /\b\d{7,}\b/g;
const EXCEPTION_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const EXCEPTION_SENSITIVE_KEY_PATTERN =
  'api[_-]?key|authorization|bvn|card(?:[_-]?number)?|cvv|customer[_-]?email|email|nin|otp|password|passcode|phone|pin|reference|secret|token|transaction[_-]?reference|tracking[_-]?token|trxref';
const EXCEPTION_SENSITIVE_ASSIGNMENT_PATTERN = new RegExp(
  `(["']?)\\b(${EXCEPTION_SENSITIVE_KEY_PATTERN})\\b\\1(\\s*[:=]\\s*)(["']?)(?:Bearer\\s+)?[^&\\s"',;)}\\]]+\\4`,
  'gi'
);

function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

export function sanitizePostHogExceptionText(value: string): string {
  return value
    .replace(EXCEPTION_URL_PATTERN, stripUrlQuery)
    .replace(
      EXCEPTION_SENSITIVE_ASSIGNMENT_PATTERN,
      (
        _match,
        keyQuote: string,
        key: string,
        separator: string,
        valueQuote: string
      ) =>
        `${keyQuote}${key}${keyQuote}${separator}${valueQuote}${REDACTED_VALUE}${valueQuote}`
    )
    .replace(EXCEPTION_EMAIL_PATTERN, REDACTED_VALUE)
    .replace(EXCEPTION_LONG_NUMBER_PATTERN, REDACTED_VALUE);
}
