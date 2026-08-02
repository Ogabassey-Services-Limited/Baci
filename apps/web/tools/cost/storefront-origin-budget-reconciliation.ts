import type { StorefrontDeliveryEvidenceManifest } from '../../../../packages/shared/src/storefront/delivery-evidence-manifest';
import { reconcileStorefrontDeliveryTrafficPartition } from '../../../../packages/shared/src/storefront/delivery-traffic-partition';

export type StorefrontDeliveryReconciliation = Readonly<{
  originEventRequests: number;
  classifiedOriginAttempts: number;
  originEventReconciled: boolean;
  hostPartitionReconciled: boolean;
  trafficPartitionReconciled: boolean;
  independentSourceCountsReconciled: boolean;
}>;

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

function originAttemptsForDay(
  day: StorefrontDeliveryEvidenceManifest['days'][number]
) {
  // Origin fallback and edge-error are final classes; do not double-count.
  return (
    day.canonicalEligibleOriginAttemptCount +
    day.dynamicOriginAttemptCount +
    day.unknownOriginAttemptCount +
    day.aliasEligibleOriginRequestCount +
    day.aliasDynamicOriginCount +
    day.rejectedMethodOriginCount +
    day.allowedOriginRateLimitCount
  );
}

/** Reconciles each independent bounded source before the cost gate can pass. */
export function reconcileStorefrontDeliveryEvidence(
  manifest: StorefrontDeliveryEvidenceManifest
): StorefrontDeliveryReconciliation {
  const { days, aliasHostnames: aliases } = manifest;
  const originEventRequests = sum(
    days.map((day) => day.sourceEvidence.originEvent.requestCount)
  );
  const classifiedOriginAttempts = sum(days.map(originAttemptsForDay));
  const originEventReconciled = days.every(
    (day) =>
      day.sourceEvidence.originEvent.requestCount === originAttemptsForDay(day)
  );
  const hostPartitionReconciled = days.every((day) => {
    const rows = day.sourceEvidence.aliasRedirect.hostPartition;
    return (
      rows.length === aliases.length &&
      rows.every(
        (row, index) =>
          row.hostname === aliases[index] &&
          row.eligibleRequestCount <= row.requestCount &&
          row.eligibleOriginAttemptCount <= row.eligibleRequestCount
      ) &&
      sum(rows.map((row) => row.requestCount)) === day.aliasRawRequestCount &&
      sum(rows.map((row) => row.eligibleRequestCount)) ===
        day.aliasEligibleRequestCount &&
      sum(rows.map((row) => row.eligibleOriginAttemptCount)) ===
        day.aliasEligibleOriginRequestCount
    );
  });
  const trafficPartitionReconciled = days.every((day) =>
    (() => {
      const canonicalRejectedMethodRequestCount = sum(
        day.trafficPartition
          .filter((row) => row.hostname === manifest.canonicalHostname)
          .map((row) => row.rejectedMethodRequestCount)
      );
      return reconcileStorefrontDeliveryTrafficPartition({
        rows: day.trafficPartition,
        inventoryHostnames: manifest.inventoryHostnames,
        canonicalHostname: manifest.canonicalHostname,
        canonicalRawRequestCount:
          day.workerInvocationCount -
          day.syntheticQualificationRequestCount +
          canonicalRejectedMethodRequestCount,
        aliasRawRequestCount: day.aliasRawRequestCount,
        canonicalEligibleRequestCount: day.canonicalEligibleRequestCount,
        aliasEligibleRequestCount: day.aliasEligibleRequestCount,
        canonicalEligibleOriginAttemptCount:
          day.canonicalEligibleOriginAttemptCount,
        aliasEligibleOriginRequestCount: day.aliasEligibleOriginRequestCount,
        rejectedMethodRequestCount: day.rejectedMethodRequestCount,
      });
    })()
  );
  const independentSourceCountsReconciled = days.every(
    (day) =>
      day.sourceEvidence.invocation.requestCount ===
        day.workerInvocationCount &&
      day.sourceEvidence.wafRateLimit.rejectedMethodRequestCount ===
        day.rejectedMethodRequestCount &&
      day.sourceEvidence.wafRateLimit.rejectedMethodOriginCount ===
        day.rejectedMethodOriginCount &&
      day.sourceEvidence.wafRateLimit.allowedOriginRateLimitCount ===
        day.allowedOriginRateLimitCount &&
      day.sourceEvidence.originEvent.requestCount ===
        originAttemptsForDay(day) &&
      day.sourceEvidence.syntheticQualification.requestCount ===
        day.syntheticQualificationRequestCount
  );
  return {
    originEventRequests,
    classifiedOriginAttempts,
    originEventReconciled,
    hostPartitionReconciled,
    trafficPartitionReconciled,
    independentSourceCountsReconciled,
  };
}
