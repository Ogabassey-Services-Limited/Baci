import { normalizeNextDeploymentId } from '../../apps/web/src/config/next-deployment-id-normalizer.mjs';

/**
 * Bind post-deploy verification to the deployment marker compiled into the
 * prebuilt Next output, rather than to a potentially stale cache response.
 */
export function readExpectedStorefrontReleaseMarker(env = process.env) {
  const marker = normalizeNextDeploymentId(
    env.BACI_NEXT_DEPLOYMENT_ID_SOURCE
  );
  if (!marker) {
    throw new Error(
      'BACI_NEXT_DEPLOYMENT_ID_SOURCE must yield a safe storefront release marker'
    );
  }
  return marker;
}
