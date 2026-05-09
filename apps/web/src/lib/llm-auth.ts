const TOKEN_INVALID_PATTERN = /[\s\p{Cc}]/u;

/**
 * Normalizes a Bearer token into an HTTP Authorization header.
 *
 * Accepts a raw token (`opaque-token`) or a full header
 * (`Bearer opaque-token`, case-insensitive). Empty input, whitespace-only,
 * control characters, or `Bearer` with no payload return null.
 */
export function buildLlmBearerAuthHeader(token: string): string | null {
  const trimmed = token.trim();

  if (!trimmed) {
    return null;
  }

  // If the input starts with "Bearer" followed by whitespace or end-of-string,
  // treat it as a full header — require a non-empty payload after the prefix.
  if (/^Bearer($|\s)/i.test(trimmed)) {
    const match = trimmed.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return null;
    }
    const payload = match[1].trim();
    if (!payload || TOKEN_INVALID_PATTERN.test(payload)) {
      return null;
    }
    return `Bearer ${payload}`;
  }

  // Otherwise treat as a raw token.
  if (TOKEN_INVALID_PATTERN.test(trimmed)) {
    return null;
  }

  return `Bearer ${trimmed}`;
}
