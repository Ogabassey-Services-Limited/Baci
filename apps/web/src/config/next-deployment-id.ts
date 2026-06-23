/**
 * Lookup priority is array order: explicit NEXT_DEPLOYMENT_ID wins, and
 * GITHUB_SHA is the lowest-priority fallback for non-Vercel prebuilt builds.
 */
const DEPLOYMENT_ID_ENV_KEYS = [
  'NEXT_DEPLOYMENT_ID',
  'VERCEL_DEPLOYMENT_ID',
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
] as const;

function normalizeDeploymentId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/[^A-Za-z0-9_.:-]+/g, '-');

  if (!/[A-Za-z0-9]/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

type DeploymentIdEnv = Partial<
  Record<(typeof DEPLOYMENT_ID_ENV_KEYS)[number], string | undefined>
>;

const DEFAULT_DEPLOYMENT_ID_ENV: DeploymentIdEnv = {
  NEXT_DEPLOYMENT_ID: process.env.NEXT_DEPLOYMENT_ID,
  VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID,
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
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
