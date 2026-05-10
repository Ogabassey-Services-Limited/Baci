const TOKEN_INVALID_PATTERN = /[\s\p{Cc}]/u;
// Defense-in-depth: reject implausibly long tokens. Real OAuth Bearer tokens
// (JWTs, opaque tokens) are well under this — 2048 covers RS512-signed JWTs
// with reasonable claims while still bounding memory/CPU on this code path.
const TOKEN_MAX_LENGTH = 2048;

/**
 * Normalizes a Bearer token into an HTTP Authorization header.
 *
 * Accepts a raw token (`opaque-token`) or a full header
 * (`Bearer opaque-token`, case-insensitive). Empty input, whitespace-only,
 * control characters, `Bearer` with no payload, or tokens longer than
 * TOKEN_MAX_LENGTH (2048) return null.
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
    if (
      !payload ||
      payload.length > TOKEN_MAX_LENGTH ||
      TOKEN_INVALID_PATTERN.test(payload)
    ) {
      return null;
    }
    return `Bearer ${payload}`;
  }

  // Reject inputs like "BearerXyz" (literal "Bearer" with no separator). These
  // are almost certainly a malformed full-header attempt rather than a real
  // token that happens to start with the substring "Bearer", and accepting
  // them would silently produce "Bearer BearerXyz".
  if (/^Bearer\S/i.test(trimmed)) {
    return null;
  }

  // Otherwise treat as a raw token.
  if (
    trimmed.length > TOKEN_MAX_LENGTH ||
    TOKEN_INVALID_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return `Bearer ${trimmed}`;
}
