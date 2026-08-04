const DEPLOYMENT_ID_MAX_LENGTH = 32;
const RESERVED_VERCEL_DEPLOYMENT_ID_PREFIX = /^dpl_/i;

/**
 * Normalize a value for Vercel's custom deployment-id contract. This stays
 * Node-compatible because the prebuilt deployment configuration and the
 * post-deploy storefront verifier must bind to the same marker.
 */
export function normalizeNextDeploymentId(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) return undefined;

  const normalized = trimmed
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, DEPLOYMENT_ID_MAX_LENGTH);

  if (!/[A-Za-z0-9]/.test(normalized)) return undefined;

  if (RESERVED_VERCEL_DEPLOYMENT_ID_PREFIX.test(normalized)) {
    return `baci_${normalized}`.slice(0, DEPLOYMENT_ID_MAX_LENGTH);
  }

  return normalized;
}
