/**
 * Username normalization shared by the API boundary and (mirrored) the
 * `set_customer_username` RPC. Usernames are ASCII-only (`a-z 0-9 . _`), which
 * already blocks Cyrillic/Greek homoglyph impersonation for free; on top of
 * that we NFKC-normalize and strip zero-width / control characters so a
 * look-alike can't be smuggled past the charset check via combining marks.
 */

const ZERO_WIDTH_AND_CONTROL =
  // zero-width space/joiner/non-joiner/BOM + C0/C1 control ranges
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional strip
  /[​-‏﻿⁠­\x00-\x1F\x7F-\x9F]/g;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// Start/end alphanumeric, middle allows single . or _ separators.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]*[a-z0-9]$/;
const CONSECUTIVE_SEPARATORS = /[._]{2}/;

/** Clean a raw username: NFKC, strip zero-width/control, trim. Casing kept. */
export function cleanUsername(raw: string): string {
  return raw.normalize('NFKC').replace(ZERO_WIDTH_AND_CONTROL, '').trim();
}

/** True when the cleaned username satisfies the charset/length rules. */
export function isValidUsername(cleaned: string): boolean {
  const lower = cleaned.toLowerCase();
  return (
    lower.length >= USERNAME_MIN_LENGTH &&
    lower.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(lower) &&
    !CONSECUTIVE_SEPARATORS.test(lower)
  );
}
