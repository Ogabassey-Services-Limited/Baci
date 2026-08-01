import { UTC_DAY_MILLISECONDS } from '../../../../packages/shared/src/storefront/utc-boundary';
import {
  type CloudflareWorkersLogsContractValidationOptions,
  type CloudflareWorkersLogsPlanContract,
  retrieveCurrentCloudflareWorkersLogsContract as retrieveRawCloudflareWorkersLogsContract,
} from './cloudflare-workers-logs-contract';

const FORCED_SAMPLING_HEADROOM_MULTIPLIER = 4n;
const MINIMUM_LOG_EVENTS_PER_INVOCATION = 2n;

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

export function validateWorkersLogsEvidence(
  workersLogsContract: unknown,
  expectedDailyWorkerInvocations: unknown,
  qualifiedLogEventsPerInvocation: unknown,
  allIngressRequests: number | undefined,
  windowDays: number,
  now: Date
) {
  if (!isRetrievedCloudflareWorkersLogsContract(workersLogsContract))
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'workers_logs_contract_invalid',
    };
  const projected = deriveProjectedAccountLogEvents(
    expectedDailyWorkerInvocations,
    qualifiedLogEventsPerInvocation,
    allIngressRequests,
    windowDays
  );
  if (projected === null)
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'workers_logs_projection_invalid',
    };
  const contract = workersLogsContract;
  const projectedWithHeadroom = projected * FORCED_SAMPLING_HEADROOM_MULTIPLIER;
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
  const end = Date.parse(contract.allowancePeriodEndsAt);
  const remainingDays = BigInt(
    Math.max(1, Math.ceil((end - now.valueOf()) / UTC_DAY_MILLISECONDS))
  );
  const projectedAllowanceUse = allowanceUsage + projected * remainingDays;
  let projectedOverageCostMinorUnits = 0n;
  if (
    allowanceUsage >= contract.allowanceEvents ||
    projectedAllowanceUse > contract.allowanceEvents
  ) {
    if (!contract.overageAllowed || contract.overageUsdPerMillion === null)
      return {
        ok: false as const,
        verdict: 'STOP' as const,
        reason: 'workers_logs_allowance_exhausted',
      };
    const rate = decimalToMinorUnits(contract.overageUsdPerMillion);
    if (rate === null)
      throw new Error('Cloudflare overage price contract drifted');
    const overageEvents = projectedAllowanceUse - contract.allowanceEvents;
    projectedOverageCostMinorUnits =
      (overageEvents * rate + 1_000_000n - 1n) / 1_000_000n;
  }
  return { ok: true as const, projectedOverageCostMinorUnits };
}
