import { UTC_DAY_MILLISECONDS } from '../../../../packages/shared/src/storefront/utc-boundary';
import {
  type CloudflareWorkersLogsContractValidationOptions,
  type CloudflareWorkersLogsPlanContract,
  retrieveCurrentCloudflareWorkersLogsContract as retrieveRawCloudflareWorkersLogsContract,
} from './cloudflare-workers-logs-contract';

const FORCED_SAMPLING_HEADROOM_MULTIPLIER = 4n;
const MINIMUM_LOG_EVENTS_PER_INVOCATION = 2n;

export type OwnerApprovedWorkersLogsHeadroomValue = bigint | number | string;
export type OwnerApprovedWorkersLogsHeadroom = Readonly<{
  /** Multiplier for the owner-approved traffic forecast (1 means no uplift). */
  trafficMultiplier: OwnerApprovedWorkersLogsHeadroomValue;
  /** Multiplier for the owner-approved error/event forecast (1 means no uplift). */
  errorMultiplier: OwnerApprovedWorkersLogsHeadroomValue;
}>;

declare const retrievedWorkersLogsContractBrand: unique symbol;

export type CloudflareWorkersLogsContractProvenance = Readonly<{
  kind: 'authenticated_provider_retrieval';
  officialDocsSha256: string;
  authenticatedEntitlementSha256: string;
}>;

export type RetrievedCloudflareWorkersLogsContract = Readonly<
  CloudflareWorkersLogsPlanContract & {
    provenance: CloudflareWorkersLogsContractProvenance;
    readonly [retrievedWorkersLogsContractBrand]: true;
  }
>;

export type CloudflareWorkersLogsContractCapability =
  RetrievedCloudflareWorkersLogsContract;

const retrievedCapabilities = new WeakSet<object>();

function brandCapability(
  contract: CloudflareWorkersLogsPlanContract
): RetrievedCloudflareWorkersLogsContract {
  const capability = {
    ...contract,
  } as unknown as RetrievedCloudflareWorkersLogsContract;
  Object.defineProperty(capability, 'provenance', {
    configurable: false,
    enumerable: false,
    value: Object.freeze({
      kind: 'authenticated_provider_retrieval' as const,
      officialDocsSha256: contract.officialDocsSha256,
      authenticatedEntitlementSha256: contract.authenticatedEntitlementSha256,
    }),
    writable: false,
  });
  Object.freeze(capability);
  retrievedCapabilities.add(capability);
  return capability;
}

export async function retrieveAuthenticatedCloudflareWorkersLogsContract(
  fetchOfficialDocs: () => Promise<string>,
  fetchAuthenticatedEntitlement: () => Promise<string>,
  contract: unknown,
  options: CloudflareWorkersLogsContractValidationOptions = {}
): Promise<RetrievedCloudflareWorkersLogsContract> {
  return brandCapability(
    await retrieveRawCloudflareWorkersLogsContract(
      fetchOfficialDocs,
      fetchAuthenticatedEntitlement,
      contract,
      options
    )
  );
}

export function isRetrievedCloudflareWorkersLogsContract(
  value: unknown
): value is RetrievedCloudflareWorkersLogsContract {
  return (
    typeof value === 'object' &&
    value !== null &&
    retrievedCapabilities.has(value)
  );
}

function positiveInteger(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null;
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && value > 0 ? BigInt(value) : null;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  }
  return null;
}

type HeadroomMultiplier = Readonly<{
  numerator: bigint;
  denominator: bigint;
}>;

function parseHeadroomMultiplier(value: unknown): HeadroomMultiplier | null {
  const serialized =
    typeof value === 'bigint'
      ? value.toString()
      : typeof value === 'number'
        ? Number.isFinite(value)
          ? value.toString()
          : null
        : typeof value === 'string'
          ? value
          : null;
  if (serialized === null) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(serialized);
  if (!match) return null;
  const fraction = match[2] ?? '';
  const denominator = 10n ** BigInt(fraction.length);
  const numerator =
    BigInt(match[1]) * denominator +
    BigInt(fraction.length > 0 ? fraction : '0');
  if (numerator < denominator) return null;
  return { numerator, denominator };
}

function applyHeadroomMultiplier(
  value: bigint,
  multiplier: HeadroomMultiplier
) {
  const scaled = value * multiplier.numerator;
  return (scaled + multiplier.denominator - 1n) / multiplier.denominator;
}

function deriveProjectedAccountLogEvents(
  expectedDailyWorkerInvocations: unknown,
  qualifiedLogEventsPerInvocation: unknown,
  allIngressRequests: number | undefined,
  windowDays: number
): bigint | null {
  const invocations = positiveInteger(expectedDailyWorkerInvocations);
  const qualifiedMultiplier = positiveInteger(qualifiedLogEventsPerInvocation);
  if (invocations === null || qualifiedMultiplier === null) return null;
  if (
    !Number.isSafeInteger(allIngressRequests) ||
    (allIngressRequests ?? 0) <= 0 ||
    !Number.isSafeInteger(windowDays) ||
    windowDays <= 0
  )
    return null;
  const observedDailyFloor = BigInt(
    Math.ceil((allIngressRequests ?? 0) / windowDays)
  );
  if (invocations < observedDailyFloor) return null;
  const eventsPerInvocation =
    qualifiedMultiplier < MINIMUM_LOG_EVENTS_PER_INVOCATION
      ? MINIMUM_LOG_EVENTS_PER_INVOCATION
      : qualifiedMultiplier;
  const projected = invocations * eventsPerInvocation;
  if (projected < invocations || projected < eventsPerInvocation) return null;
  return projected;
}

function decimalToMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function overageEvents(projectedUse: bigint, allowance: bigint) {
  return projectedUse > allowance ? projectedUse - allowance : 0n;
}

const INVALID_WORKERS_LOGS_PROJECTION = Object.freeze({
  ok: false as const,
  verdict: 'NOT_PROVEN' as const,
  reason: 'workers_logs_projection_invalid' as const,
});

export function validateWorkersLogsEvidence(
  workersLogsContract: unknown,
  expectedDailyWorkerInvocations: unknown,
  qualifiedLogEventsPerInvocation: unknown,
  allIngressRequests: number | undefined,
  windowDays: number,
  ownerApprovedHeadroom: Readonly<{
    trafficMultiplier: unknown;
    errorMultiplier: unknown;
  }>,
  now: Date
) {
  if (!isRetrievedCloudflareWorkersLogsContract(workersLogsContract))
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'workers_logs_contract_invalid',
    };
  const trafficMultiplier = parseHeadroomMultiplier(
    ownerApprovedHeadroom?.trafficMultiplier
  );
  const errorMultiplier = parseHeadroomMultiplier(
    ownerApprovedHeadroom?.errorMultiplier
  );
  if (!trafficMultiplier || !errorMultiplier)
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'workers_logs_headroom_invalid',
    };
  const projected = deriveProjectedAccountLogEvents(
    expectedDailyWorkerInvocations,
    qualifiedLogEventsPerInvocation,
    allIngressRequests,
    windowDays
  );
  if (projected === null) return INVALID_WORKERS_LOGS_PROJECTION;
  const contract = workersLogsContract;
  // Add measured other-Worker volume before account-wide headroom.
  const projectedAccountLogEventsPerDay =
    projected + contract.otherWorkersWorstCaseDailyLogEvents;
  if (projectedAccountLogEventsPerDay < projected)
    return INVALID_WORKERS_LOGS_PROJECTION;
  const projectedAccountLogEventsWithTrafficHeadroomPerDay =
    applyHeadroomMultiplier(projectedAccountLogEventsPerDay, trafficMultiplier);
  const projectedAccountLogEventsWithHeadroomPerDay = applyHeadroomMultiplier(
    projectedAccountLogEventsWithTrafficHeadroomPerDay,
    errorMultiplier
  );
  const projectedWithHeadroom =
    projectedAccountLogEventsWithHeadroomPerDay *
    FORCED_SAMPLING_HEADROOM_MULTIPLIER;
  if (
    contract.currentUtcDayAllAccountEvents + projectedWithHeadroom >=
    contract.forcedSamplingDailyThreshold
  )
    return {
      ok: false as const,
      verdict: 'STOP' as const,
      reason: 'workers_logs_forced_sampling_headroom_insufficient',
    };
  const allowanceUsage = contract.currentAllowancePeriodAllAccountEvents;
  const start = Date.parse(contract.allowancePeriodStartsAt);
  const end = Date.parse(contract.allowancePeriodEndsAt);
  const nowMs = now.valueOf();
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(nowMs) ||
    nowMs < start ||
    nowMs >= end
  )
    return INVALID_WORKERS_LOGS_PROJECTION;
  const remainingDaysNumber = Math.ceil((end - nowMs) / UTC_DAY_MILLISECONDS);
  if (!Number.isSafeInteger(remainingDaysNumber) || remainingDaysNumber <= 0)
    return INVALID_WORKERS_LOGS_PROJECTION;
  const remainingDays = BigInt(remainingDaysNumber);
  let projectedOverageEvents = overageEvents(
    allowanceUsage +
      projectedAccountLogEventsWithHeadroomPerDay * remainingDays,
    contract.allowanceEvents
  );
  if (contract.plan === 'paid') {
    const periodEnd = new Date(end);
    const nextPeriodEnd = Date.UTC(
      periodEnd.getUTCFullYear(),
      periodEnd.getUTCMonth() + 1,
      1
    );
    const fullPeriodDaysNumber = (nextPeriodEnd - end) / UTC_DAY_MILLISECONDS;
    if (
      !Number.isFinite(nextPeriodEnd) ||
      !Number.isSafeInteger(fullPeriodDaysNumber) ||
      fullPeriodDaysNumber <= 0
    )
      return INVALID_WORKERS_LOGS_PROJECTION;
    const projectedNextPeriodUse =
      projectedAccountLogEventsWithHeadroomPerDay *
      BigInt(fullPeriodDaysNumber);
    // Reset allowance; price the next month from zero.
    projectedOverageEvents += overageEvents(
      projectedNextPeriodUse,
      contract.allowanceEvents
    );
  }
  let projectedOverageCostMinorUnits = 0n;
  if (projectedOverageEvents > 0n) {
    if (!contract.overageAllowed || contract.overageUsdPerMillion === null)
      return {
        ok: false as const,
        verdict: 'STOP' as const,
        reason: 'workers_logs_allowance_exhausted',
      };
    const rate = decimalToMinorUnits(contract.overageUsdPerMillion);
    if (rate === null)
      throw new Error('Cloudflare overage price contract drifted');
    projectedOverageCostMinorUnits =
      (projectedOverageEvents * rate + 1_000_000n - 1n) / 1_000_000n;
  }
  return { ok: true as const, projectedOverageCostMinorUnits };
}
