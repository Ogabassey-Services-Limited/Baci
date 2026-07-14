/**
 * `%2f` / `%5c` smuggle a path separator past a naive path check, so they are
 * banned in the PATH. They carry no such meaning inside a query VALUE — a real
 * address ("Flat 1/2") or a biller name legitimately percent-encodes to `%2F`
 * there — so the query is validated separately (see `isSafeQuery`).
 */
const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:2f|5c)/i;

/**
 * Query keys that would nest another destination inside the destination and
 * hand an attacker a second, unvalidated hop out of the app.
 */
const NESTED_REDIRECT_KEY_PATTERN =
  /^(?:returnto|return_to|redirect|redirect_uri|redirecturi|next|url|uri|link|continue|callback|callback_url|callbackurl|destination|dest|to|goto)$/i;

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/**
 * The path is the only part of the href that steers navigation, so every
 * traversal/escape check applies here at full strength — against both the raw
 * and the decoded form, so a double-encoded separator (`%252f`) cannot slip
 * through by decoding into a real one.
 */
function isSafePath(path: string): boolean {
  if (ENCODED_PATH_SEPARATOR_PATTERN.test(path)) {
    return false;
  }

  const decoded = decode(path);
  if (decoded === undefined) {
    return false;
  }
  if (ENCODED_PATH_SEPARATOR_PATTERN.test(decoded)) {
    return false;
  }

  return (
    decoded.startsWith('/') &&
    !decoded.startsWith('//') &&
    !decoded.includes('\\') &&
    !decoded.includes('/../') &&
    !decoded.includes('/./') &&
    !decoded.endsWith('/..') &&
    !decoded.endsWith('/.')
  );
}

/**
 * The query never steers navigation — it only prefills a form — so slashes and
 * backslashes are allowed inside values. It must still be well-formed
 * (`key=value` pairs that decode cleanly) and must not nest another redirect
 * target, which would smuggle a second hop past this check.
 */
function isSafeQuery(query: string): boolean {
  if (query.length === 0) {
    return false;
  }

  return query.split('&').every((pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) {
      return false;
    }

    const key = decode(pair.slice(0, separatorIndex));
    const value = decode(pair.slice(separatorIndex + 1));
    if (key === undefined || value === undefined) {
      return false;
    }

    return !NESTED_REDIRECT_KEY_PATTERN.test(key);
  });
}

/**
 * Validates a wallet "return to your purchase" destination as a safe internal
 * path. The href is split at the first `?`: the path is held to the full
 * traversal/escape rules, while the query is only required to be well-formed
 * and free of nested redirects. Fragments are rejected outright — nothing in
 * this app produces one, and one would otherwise carry unchecked path-ish text
 * past the path rules.
 *
 * Kept byte-for-byte in step with the mobile-storefront copy
 * (`apps/mobile-storefront/lib/sanitize-wallet-return-to.ts`, which adds only
 * the expo-router `Href` typing) so the server never persists a value the app
 * would reject, and never rejects one the app would accept.
 */
export function sanitizeWalletReturnToPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.includes('#')) {
    return undefined;
  }

  const queryIndex = value.indexOf('?');
  const path = queryIndex === -1 ? value : value.slice(0, queryIndex);

  if (!isSafePath(path)) {
    return undefined;
  }
  if (queryIndex !== -1 && !isSafeQuery(value.slice(queryIndex + 1))) {
    return undefined;
  }

  return value;
}
