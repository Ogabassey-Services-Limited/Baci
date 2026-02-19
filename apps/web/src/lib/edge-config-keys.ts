const EDGE_CONFIG_INVALID_KEY_CHARS_REGEX = /[^a-z0-9_-]/g;

function normalizeEdgeConfigValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Edge Config keys support only [a-zA-Z0-9_-].
 * We normalize slug keys to avoid invalid ":" separators.
 */
export function getEdgeConfigSlugKey(slug: string): string {
  const normalizedSlug = normalizeEdgeConfigValue(slug).replace(
    EDGE_CONFIG_INVALID_KEY_CHARS_REGEX,
    '_'
  );
  return `slug_${normalizedSlug}`;
}

/**
 * Edge Config keys support only [a-zA-Z0-9_-].
 * Domain keys are normalized by replacing "." with "_".
 */
export function getEdgeConfigDomainKey(domain: string): string {
  const normalizedDomain = normalizeEdgeConfigValue(domain).replace(
    EDGE_CONFIG_INVALID_KEY_CHARS_REGEX,
    '_'
  );
  return `domain_${normalizedDomain}`;
}
