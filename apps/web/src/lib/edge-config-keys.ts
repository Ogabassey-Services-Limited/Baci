const EDGE_CONFIG_INVALID_KEY_CHARS_REGEX = /[^a-z0-9_-]/g;

/**
 * Normalizes key input by trimming and lowercasing before character filtering.
 */
function normalizeEdgeConfigValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Edge Config keys support only lowercase ASCII letters, digits, underscore,
 * and hyphen (`a-z0-9_-`).
 * `normalizeEdgeConfigValue` lowercases input before invalid characters are
 * replaced with underscores.
 */
export function getEdgeConfigSlugKey(slug: string): string {
  const normalizedSlug = normalizeEdgeConfigValue(slug).replace(
    EDGE_CONFIG_INVALID_KEY_CHARS_REGEX,
    '_'
  );
  return `slug_${normalizedSlug}`;
}

/**
 * Edge Config keys support only lowercase ASCII letters, digits, underscore,
 * and hyphen (`a-z0-9_-`).
 * `normalizeEdgeConfigValue` lowercases input, and `getEdgeConfigDomainKey`
 * replaces all invalid characters (not only ".") with underscores.
 */
export function getEdgeConfigDomainKey(domain: string): string {
  const normalizedDomain = normalizeEdgeConfigValue(domain).replace(
    EDGE_CONFIG_INVALID_KEY_CHARS_REGEX,
    '_'
  );
  return `domain_${normalizedDomain}`;
}
