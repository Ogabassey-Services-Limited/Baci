import {
  type StorefrontDeliveryEvidenceManifest,
  validateStorefrontDeliveryManifest,
} from '../../../../packages/shared/src/storefront/delivery-evidence-manifest';

export type StorefrontDeliverySummary = {
  evidenceMode: 'census' | 'sampled';
  evidenceComplete: boolean;
  canonicalEligibleRequests: number;
  aliasEligibleRequests: number;
  allEligibleIngress: number;
  canonicalEligibleOriginAttempts: number;
  aliasEligibleOriginAttempts: number;
  allEligibleOriginAttempts: number;
  originRate: number;
  unknownOriginAttempts: number;
  rejectedMethodOriginAttempts: number;
  verdict: 'PASS' | 'FAIL' | 'NOT_PROVEN';
};

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

/** Produces the fail-closed all-ingress production origin-avoidance decision. */
export function summarizeStorefrontDelivery(
  value: unknown
): StorefrontDeliverySummary {
  const validation = validateStorefrontDeliveryManifest(value);
  const manifest = value as StorefrontDeliveryEvidenceManifest;
  const days = Array.isArray(manifest?.days) ? manifest.days : [];
  const canonicalEligibleRequests = sum(
    days.map((day) => day.canonicalEligibleRequestCount ?? 0)
  );
  const aliasEligibleRequests = sum(
    days.map((day) => day.aliasEligibleRequestCount ?? 0)
  );
  const canonicalEligibleOriginAttempts = sum(
    days.map((day) => day.canonicalEligibleOriginAttemptCount ?? 0)
  );
  const aliasEligibleOriginAttempts = sum(
    days.map((day) => day.aliasEligibleOriginRequestCount ?? 0)
  );
  const unknownOriginAttempts = sum(
    days.map((day) => day.unknownOriginAttemptCount ?? 0)
  );
  const rejectedMethodOriginAttempts = sum(
    days.map((day) => day.rejectedMethodOriginCount ?? 0)
  );
  const allEligibleIngress = canonicalEligibleRequests + aliasEligibleRequests;
  const allEligibleOriginAttempts =
    canonicalEligibleOriginAttempts + aliasEligibleOriginAttempts;
  const originRate =
    allEligibleIngress > 0
      ? allEligibleOriginAttempts / allEligibleIngress
      : Number.NaN;
  const evidenceComplete =
    validation.ok &&
    days.every(
      (day) =>
        day.exportComplete &&
        !day.providerSamplingApplied &&
        day.maxSampleInterval === 1 &&
        day.invocationCountExact &&
        day.totalDecisionCount === day.workerInvocationCount &&
        day.aliasEligibleRequestCount === day.aliasEdgeRedirectCount
    );
  const evidenceMode = evidenceComplete ? 'census' : 'sampled';
  const hardFailure =
    unknownOriginAttempts > 0 ||
    rejectedMethodOriginAttempts > 0 ||
    aliasEligibleOriginAttempts > 0 ||
    (evidenceComplete && Number.isFinite(originRate) && originRate > 0.001);
  return {
    evidenceMode,
    evidenceComplete,
    canonicalEligibleRequests,
    aliasEligibleRequests,
    allEligibleIngress,
    canonicalEligibleOriginAttempts,
    aliasEligibleOriginAttempts,
    allEligibleOriginAttempts,
    originRate,
    unknownOriginAttempts,
    rejectedMethodOriginAttempts,
    verdict: hardFailure
      ? 'FAIL'
      : evidenceComplete && allEligibleIngress > 0
        ? 'PASS'
        : 'NOT_PROVEN',
  };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  throw new Error(
    'Pass a sealed manifest through the audited cost tooling; this gate never reads raw request rows.'
  );
}
