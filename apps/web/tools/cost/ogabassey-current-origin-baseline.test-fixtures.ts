import { createHash } from 'node:crypto';
import type { CloudflareWorkersLogsPlanContract } from './cloudflare-workers-logs-contract';
import { retrieveCurrentCloudflareWorkersLogsContract } from './ogabassey-current-origin-baseline';

const NOW = new Date('2026-08-01T12:00:00.000Z');
const OFFICIAL_DOCS = 'current-workers-logs-docs';

const BASE_WORKERS_LOGS_CONTRACT = {
  plan: 'free' as const,
  allowanceEvents: 200_000n,
  allowancePeriod: 'utc_day' as const,
  allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
  allowancePeriodEndsAt: '2026-08-02T00:00:00.000Z',
  currentAllowancePeriodAllAccountEvents: 1_234n,
  allowanceUsageSourceFingerprint: '1'.repeat(64),
  allowanceMaximumObservationLagSeconds: 3_600,
  allowanceObservedAt: '2026-08-01T11:30:00.000Z',
  utcDayStartsAt: '2026-08-01T00:00:00.000Z',
  utcDayEndsAt: '2026-08-02T00:00:00.000Z',
  currentUtcDayAllAccountEvents: 2_345n,
  utcDayUsageSourceFingerprint: '2'.repeat(64),
  utcDayMaximumObservationLagSeconds: 3_600,
  utcDayObservedAt: '2026-08-01T11:30:00.000Z',
  overageAllowed: false,
  overageUsdPerMillion: null,
  forcedSamplingDailyThreshold: 5_000_000_000n,
  forcedSamplingRate: '0.01',
  officialDocsSha256: '',
  authenticatedEntitlementSha256: '',
};

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function entitlementReceipt(contract: Record<string, unknown>) {
  const projection: Record<string, unknown> = { ...contract };
  delete projection.officialDocsSha256;
  delete projection.authenticatedEntitlementSha256;
  return JSON.stringify(projection, (_, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

export function currentWithWorkersLogsContract(
  overrides: Partial<CloudflareWorkersLogsPlanContract> = {}
) {
  const unsigned = {
    ...BASE_WORKERS_LOGS_CONTRACT,
    ...overrides,
    officialDocsSha256: sha256(OFFICIAL_DOCS),
    authenticatedEntitlementSha256: '',
  };
  const rawEntitlement = entitlementReceipt(unsigned);
  const contract = {
    ...unsigned,
    authenticatedEntitlementSha256: sha256(rawEntitlement),
  };
  return retrieveCurrentCloudflareWorkersLogsContract(
    async () => OFFICIAL_DOCS,
    async () => rawEntitlement,
    contract,
    { now: NOW }
  );
}

const BASE_INPUT = {
  windowDays: 7,
  windowStart: '2026-07-25T00:00:00.000Z',
  windowEnd: '2026-08-01T00:00:00.000Z',
  observedAt: '2026-08-01T11:00:00.000Z',
  allIngressRequests: 1_000,
  allIngressOriginAttempts: 20,
  discoveredHostnames: [
    'ogabassey.com',
    'ogabassey.usebaci.com',
    'www.ogabassey.com',
  ],
  completeHostEvidence: true,
  currentVercelAttributionUsd: '12.00',
  projectedEdgeCostUsd: '2.00',
  originCostProjection: {
    irreducibleDynamicOriginCostUsd: '2.00',
    reducibleStaticOriginCostUsd: '10.00',
  },
  ownerApprovedPaybackMonths: 12,
  paybackMonths: 2,
  expectedDailyWorkerInvocations: 143n,
  qualifiedLogEventsPerInvocation: 2n,
};

export const current = {
  ...BASE_INPUT,
  workersLogsContract: await currentWithWorkersLogsContract(),
};
