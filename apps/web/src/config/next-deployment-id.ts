/**
 * Lookup priority is array order: the neutral prebuilt source wins and
 * GITHUB_SHA is the fallback for non-Vercel prebuilt builds. Do not read
 * NEXT_DEPLOYMENT_ID as an input source: Next/Vercel also observe that exact
 * env var directly, so unnormalized manual values can bypass this helper.
 *
 * Vercel's prebuilt Skew Protection custom deployment IDs must not use the
 * reserved dpl_ prefix, must be at most 32 characters, and may only contain
 * alphanumeric characters, hyphens, and underscores. Keep those rules here so
 * a future deploy cannot silently emit an ID that Vercel refuses or ignores.
 */
const DEPLOYMENT_ID_ENV_KEYS = [
  'BACI_NEXT_DEPLOYMENT_ID_SOURCE',
  'GITHUB_SHA',
] as const;

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
  // Accept these keys in tests/input fixtures, but do not iterate them above:
  // NEXT_DEPLOYMENT_ID is the env var Next/Vercel also read directly, and
  // VERCEL_DEPLOYMENT_ID uses Vercel's reserved dpl_ deployment prefix. Neither
  // is valid as a custom prebuilt Skew Protection deploymentId input.
  | 'NEXT_DEPLOYMENT_ID'
  | 'VERCEL_DEPLOYMENT_ID';

type DeploymentIdEnv = Partial<Record<DeploymentIdEnvKey, string | undefined>>;
type MutableDeploymentIdEnv = Record<string, string | undefined>;

const DEFAULT_DEPLOYMENT_ID_ENV: DeploymentIdEnv = {
  BACI_NEXT_DEPLOYMENT_ID_SOURCE: process.env.BACI_NEXT_DEPLOYMENT_ID_SOURCE,
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

/**
 * Keep Next's direct `process.env.NEXT_DEPLOYMENT_ID` override synchronized
 * with the normalized config value before `next.config.ts` is exported. If no
 * safe custom ID is configured, clear it so a raw dpl_ or oversized manual env
 * value cannot bypass the normalization above.
 */
export function applyNextDeploymentIdEnv(
  env: MutableDeploymentIdEnv = process.env,
  deploymentId = getNextDeploymentId(env)
): string | undefined {
  if (deploymentId) {
    env.NEXT_DEPLOYMENT_ID = deploymentId;
  } else {
    delete env.NEXT_DEPLOYMENT_ID;
  }

  return deploymentId;
}
