/**
 * Lookup priority is array order: explicit NEXT_DEPLOYMENT_ID wins, and
 * GITHUB_SHA is the fallback for non-Vercel prebuilt builds.
 *
 * Vercel's prebuilt Skew Protection custom deployment IDs must not use the
 * reserved dpl_ prefix, must be at most 32 characters, and may only contain
 * alphanumeric characters, hyphens, and underscores. Keep those rules here so
 * a future deploy cannot silently emit an ID that Vercel refuses or ignores.
 */
const DEPLOYMENT_ID_ENV_KEYS = ['NEXT_DEPLOYMENT_ID', 'GITHUB_SHA'] as const;

const DEPLOYMENT_ID_MAX_LENGTH = 32;
const RESERVED_VERCEL_DEPLOYMENT_ID_PREFIX = /^dpl_/i;

function normalizeDeploymentId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, DEPLOYMENT_ID_MAX_LENGTH);

  if (!/[A-Za-z0-9]/.test(normalized)) {
    return undefined;
  }

  if (RESERVED_VERCEL_DEPLOYMENT_ID_PREFIX.test(normalized)) {
    return `baci_${normalized}`.slice(0, DEPLOYMENT_ID_MAX_LENGTH);
  }

  return normalized;
}

type DeploymentIdEnvKey =
  | (typeof DEPLOYMENT_ID_ENV_KEYS)[number]
  // Accept this key in tests/input fixtures, but do not iterate it above:
  // Vercel reserves the dpl_ prefix for platform deployment IDs, so it is not
  // valid as a custom prebuilt Skew Protection deploymentId.
  | 'VERCEL_DEPLOYMENT_ID';

type DeploymentIdEnv = Partial<Record<DeploymentIdEnvKey, string | undefined>>;

const DEFAULT_DEPLOYMENT_ID_ENV: DeploymentIdEnv = {
  NEXT_DEPLOYMENT_ID: process.env.NEXT_DEPLOYMENT_ID,
  GITHUB_SHA: process.env.GITHUB_SHA,
};

export function getNextDeploymentId(
  env: DeploymentIdEnv = DEFAULT_DEPLOYMENT_ID_ENV
): string | undefined {
  for (const key of DEPLOYMENT_ID_ENV_KEYS) {
    const deploymentId = normalizeDeploymentId(env[key]);

    if (deploymentId) {
      return deploymentId;
    }
  }

  return undefined;
}
