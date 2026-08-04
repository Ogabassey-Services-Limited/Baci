import { normalizeNextDeploymentId } from './next-deployment-id-normalizer.mjs';

/**
 * Lookup priority is array order: the neutral prebuilt source wins and
 * GITHUB_SHA is the fallback for non-Vercel prebuilt builds. Do not read
 * NEXT_DEPLOYMENT_ID as an input source: Next/Vercel also observe that exact
 * env var directly, so unnormalized manual values can bypass this helper.
 */
const DEPLOYMENT_ID_ENV_KEYS = [
  'BACI_NEXT_DEPLOYMENT_ID_SOURCE',
  'GITHUB_SHA',
] as const;

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
    const deploymentId = normalizeNextDeploymentId(env[key]);

    if (deploymentId) {
      return deploymentId;
    }
  }

  return undefined;
}

/**
 * Return the normalized custom deployment ID for `next.config.ts` while clearing
 * Next's direct `process.env.NEXT_DEPLOYMENT_ID` override. Next 16 enables its
 * runtime server deployment-id path when that env var is present during the
 * production build; prebuilt Skew Protection must instead use the stable custom
 * `deploymentId` value serialized into the config.
 */
export function applyNextDeploymentIdEnv(
  env: MutableDeploymentIdEnv = process.env,
  deploymentId = getNextDeploymentId(env)
): string | undefined {
  delete env.NEXT_DEPLOYMENT_ID;

  return deploymentId;
}
