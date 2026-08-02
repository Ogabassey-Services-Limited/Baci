const MAX_DISCOVERED_HOSTS = 256;
const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export type OgabasseyOriginHostEvidence = Readonly<{
  hostname: string;
  requestCount: number;
  originAttemptCount: number;
  eligibleStaticRequestCount: number;
  eligibleStaticOriginAttemptCount: number;
  dynamicRequestCount: number;
  dynamicOriginAttemptCount: number;
}>;

export type OgabasseyBaselineTrafficProjection = Readonly<{
  eligibleStaticRequests: number;
  eligibleStaticOriginAttempts: number;
  dynamicRequests: number;
  dynamicOriginAttempts: number;
}>;

type ReconciliationResult =
  | Readonly<{
      ok: true;
      projection: OgabasseyBaselineTrafficProjection;
    }>
  | Readonly<{
      ok: false;
      reason: 'host_traffic_evidence_invalid';
    }>;

function isSafeNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedHostname(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 253 &&
    HOSTNAME_PATTERN.test(value)
  );
}

function isHostEvidence(value: unknown): value is OgabasseyOriginHostEvidence {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const row = value as Record<string, unknown>;
  return (
    isBoundedHostname(row.hostname) &&
    isSafeNonnegativeInteger(row.requestCount) &&
    isSafeNonnegativeInteger(row.originAttemptCount) &&
    isSafeNonnegativeInteger(row.eligibleStaticRequestCount) &&
    isSafeNonnegativeInteger(row.eligibleStaticOriginAttemptCount) &&
    isSafeNonnegativeInteger(row.dynamicRequestCount) &&
    isSafeNonnegativeInteger(row.dynamicOriginAttemptCount)
  );
}

/** Reconciles all discovered-host totals before the baseline can pass. */
export function reconcileOgabasseyBaselineHostEvidence(
  hostEvidence: unknown,
  discoveredHostnames: readonly string[],
  allIngressRequests: number | undefined,
  allIngressOriginAttempts: number | undefined
): ReconciliationResult {
  if (
    !Array.isArray(hostEvidence) ||
    hostEvidence.length === 0 ||
    hostEvidence.length > MAX_DISCOVERED_HOSTS ||
    !Array.isArray(discoveredHostnames) ||
    discoveredHostnames.length === 0 ||
    discoveredHostnames.length > MAX_DISCOVERED_HOSTS ||
    discoveredHostnames.length !== hostEvidence.length ||
    new Set(discoveredHostnames).size !== discoveredHostnames.length ||
    discoveredHostnames.some((hostname) => !isBoundedHostname(hostname)) ||
    !isSafeNonnegativeInteger(allIngressRequests) ||
    allIngressRequests === 0 ||
    !isSafeNonnegativeInteger(allIngressOriginAttempts) ||
    allIngressOriginAttempts > allIngressRequests
  )
    return { ok: false, reason: 'host_traffic_evidence_invalid' };

  const discovered = new Set(discoveredHostnames);
  const seen = new Set<string>();
  let requestTotal = 0;
  let originAttemptTotal = 0;
  let eligibleStaticRequests = 0;
  let eligibleStaticOriginAttempts = 0;
  let dynamicRequests = 0;
  let dynamicOriginAttempts = 0;
  for (const candidate of hostEvidence) {
    if (!isHostEvidence(candidate) || !discovered.has(candidate.hostname))
      return { ok: false, reason: 'host_traffic_evidence_invalid' };
    if (seen.has(candidate.hostname))
      return { ok: false, reason: 'host_traffic_evidence_invalid' };
    seen.add(candidate.hostname);
    if (
      candidate.eligibleStaticRequestCount + candidate.dynamicRequestCount !==
        candidate.requestCount ||
      candidate.eligibleStaticOriginAttemptCount +
        candidate.dynamicOriginAttemptCount !==
        candidate.originAttemptCount ||
      candidate.eligibleStaticOriginAttemptCount >
        candidate.eligibleStaticRequestCount ||
      candidate.dynamicOriginAttemptCount > candidate.dynamicRequestCount
    )
      return { ok: false, reason: 'host_traffic_evidence_invalid' };
    if (
      requestTotal > Number.MAX_SAFE_INTEGER - candidate.requestCount ||
      originAttemptTotal >
        Number.MAX_SAFE_INTEGER - candidate.originAttemptCount ||
      eligibleStaticRequests >
        Number.MAX_SAFE_INTEGER - candidate.eligibleStaticRequestCount ||
      eligibleStaticOriginAttempts >
        Number.MAX_SAFE_INTEGER - candidate.eligibleStaticOriginAttemptCount ||
      dynamicRequests >
        Number.MAX_SAFE_INTEGER - candidate.dynamicRequestCount ||
      dynamicOriginAttempts >
        Number.MAX_SAFE_INTEGER - candidate.dynamicOriginAttemptCount
    )
      return { ok: false, reason: 'host_traffic_evidence_invalid' };
    requestTotal += candidate.requestCount;
    originAttemptTotal += candidate.originAttemptCount;
    eligibleStaticRequests += candidate.eligibleStaticRequestCount;
    eligibleStaticOriginAttempts += candidate.eligibleStaticOriginAttemptCount;
    dynamicRequests += candidate.dynamicRequestCount;
    dynamicOriginAttempts += candidate.dynamicOriginAttemptCount;
  }
  if (
    seen.size !== discovered.size ||
    requestTotal !== allIngressRequests ||
    originAttemptTotal !== allIngressOriginAttempts
  )
    return { ok: false, reason: 'host_traffic_evidence_invalid' };
  return {
    ok: true,
    projection: {
      eligibleStaticRequests,
      eligibleStaticOriginAttempts,
      dynamicRequests,
      dynamicOriginAttempts,
    },
  };
}
