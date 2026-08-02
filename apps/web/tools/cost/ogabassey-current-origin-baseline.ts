import { parseStrictUtcBoundary, UTC_DAY_MILLISECONDS } from '@baci/shared';
import {
  type RetrievedCloudflareWorkersLogsContract,
  validateWorkersLogsEvidence,
} from './ogabassey-current-origin-baseline-workers-logs';
import { DEFAULT_ORIGIN_RATE_THRESHOLD } from './origin-rate-constants';

export type {
  CloudflareWorkersLogsContractValidationOptions,
  CloudflareWorkersLogsEntitlement,
  CloudflareWorkersLogsPlanContract,
} from './cloudflare-workers-logs-contract';
export {
  CloudflareWorkersLogsEntitlementSchema,
  CloudflareWorkersLogsPlanContractSchema,
  validateCloudflareWorkersLogsPlanContract,
} from './cloudflare-workers-logs-contract';
export type {
  CloudflareWorkersLogsContractCapability,
  CloudflareWorkersLogsContractProvenance,
  RetrievedCloudflareWorkersLogsContract,
} from './ogabassey-current-origin-baseline-workers-logs';
export {
  isRetrievedCloudflareWorkersLogsContract,
  retrieveAuthenticatedCloudflareWorkersLogsContract as retrieveCurrentCloudflareWorkersLogsContract,
} from './ogabassey-current-origin-baseline-workers-logs';

const DEFAULT_MAXIMUM_BASELINE_AGE_DAYS = 7;
export type OgabasseyOriginCostProjection = Readonly<{
  irreducibleDynamicOriginCostUsd: string;
  reducibleStaticOriginCostUsd: string;
}>;
export type OgabasseyOriginBusinessCaseInput = {
  windowDays: number;
  windowStart?: string;
  windowEnd?: string;
  observedAt: string;
  allIngressRequests?: number;
  allIngressOriginAttempts?: number;
  discoveredHostnames: readonly string[];
  completeHostEvidence: boolean;
  currentVercelAttributionUsd?: string;
  projectedEdgeCostUsd?: string;
  originCostProjection?: OgabasseyOriginCostProjection;
  ownerApprovedPaybackMonths?: number;
  /** Independently verified one-time implementation cost, in USD. */
  verifiedUpfrontImplementationCostUsd?: string;
  /** Legacy observation retained for input compatibility; never used for gating. */
  paybackMonths?: number;
  workersLogsContract: RetrievedCloudflareWorkersLogsContract;
  expectedDailyWorkerInvocations: bigint | number | string;
  qualifiedLogEventsPerInvocation: bigint | number | string;
};
export type OgabasseyOriginBusinessCaseOptions = Readonly<{
  now?: Date;
  maximumWindowAgeDays?: number;
}>;
function decimalToMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}
function validateOriginCostProjection(input: OgabasseyOriginBusinessCaseInput) {
  const dynamic = decimalToMinorUnits(
    input.originCostProjection?.irreducibleDynamicOriginCostUsd ?? ''
  );
  const reducibleStatic = decimalToMinorUnits(
    input.originCostProjection?.reducibleStaticOriginCostUsd ?? ''
  );
  if (dynamic === null || reducibleStatic === null)
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'origin_cost_projection_invalid',
    };
  const current = decimalToMinorUnits(input.currentVercelAttributionUsd ?? '');
  if (current !== null && dynamic + reducibleStatic !== current)
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'origin_cost_projection_mismatch',
    };
  if (dynamic >= reducibleStatic)
    return {
      ok: false as const,
      verdict: 'STOP' as const,
      reason: 'dynamic_origin_cost_dominant',
    };
  return { ok: true as const, dynamicMinorUnits: dynamic };
}
/** Gates design work on a complete, current, all-ingress baseline—not a percentage claim. */
export function evaluateOgabasseyOriginBusinessCase(
  input: OgabasseyOriginBusinessCaseInput,
  options: OgabasseyOriginBusinessCaseOptions = {}
): {
  verdict: 'PROCEED' | 'STOP' | 'NOT_PROVEN';
  reasonCodes: readonly string[];
} {
  const reasons: string[] = [];
  const windowStart = input.windowStart
    ? parseStrictUtcBoundary(input.windowStart)
    : null;
  const windowEnd = input.windowEnd
    ? parseStrictUtcBoundary(input.windowEnd)
    : null;
  const now = options.now ?? new Date();
  const nowMs = now.valueOf();
  const maximumWindowAgeDays =
    options.maximumWindowAgeDays ?? DEFAULT_MAXIMUM_BASELINE_AGE_DAYS;
  let baselineWindowValid = true;
  if (!windowStart || !windowEnd) {
    reasons.push('baseline_window_missing_or_invalid');
    baselineWindowValid = false;
  } else if (
    windowEnd.valueOf() - windowStart.valueOf() !==
    7 * UTC_DAY_MILLISECONDS
  ) {
    reasons.push('baseline_window_not_seven_days');
    baselineWindowValid = false;
  }
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(maximumWindowAgeDays) ||
    !Number.isInteger(maximumWindowAgeDays) ||
    maximumWindowAgeDays < 0
  ) {
    reasons.push('baseline_window_clock_or_age_invalid');
    baselineWindowValid = false;
  } else if (windowEnd) {
    const currentUtcDayStart = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    if (windowEnd.valueOf() > currentUtcDayStart) {
      reasons.push('baseline_window_not_closed');
      baselineWindowValid = false;
    } else if (
      currentUtcDayStart - windowEnd.valueOf() >
      maximumWindowAgeDays * UTC_DAY_MILLISECONDS
    ) {
      reasons.push('baseline_window_stale');
      baselineWindowValid = false;
    }
  }
  const observedAtMs =
    typeof input.observedAt === 'string'
      ? new Date(input.observedAt).valueOf()
      : Number.NaN;
  if (
    !Number.isFinite(observedAtMs) ||
    observedAtMs > nowMs ||
    (windowEnd !== null && observedAtMs < windowEnd.valueOf())
  ) {
    reasons.push('baseline_observation_invalid');
    baselineWindowValid = false;
  }
  if (
    input.windowDays !== 7 ||
    !Number.isInteger(input.allIngressRequests) ||
    !Number.isInteger(input.allIngressOriginAttempts) ||
    (input.allIngressRequests ?? 0) <= 0
  )
    reasons.push('baseline_not_current_all_ingress');
  if (!baselineWindowValid) reasons.push('baseline_not_current_all_ingress');
  if (
    Number.isInteger(input.allIngressRequests) &&
    Number.isInteger(input.allIngressOriginAttempts) &&
    ((input.allIngressOriginAttempts ?? 0) < 0 ||
      (input.allIngressOriginAttempts ?? 0) > (input.allIngressRequests ?? 0))
  )
    reasons.push('origin_attempt_count_invalid');
  if (
    !input.completeHostEvidence ||
    input.discoveredHostnames.length < 3 ||
    !['ogabassey.com', 'www.ogabassey.com', 'ogabassey.usebaci.com'].every(
      (hostname) => input.discoveredHostnames.includes(hostname)
    )
  )
    reasons.push('host_inventory_incomplete');
  if (reasons.length) return { verdict: 'NOT_PROVEN', reasonCodes: reasons };
  const originAvoidanceRate =
    (input.allIngressOriginAttempts ?? 0) /
    (input.allIngressRequests ?? Number.NaN);
  if (originAvoidanceRate <= DEFAULT_ORIGIN_RATE_THRESHOLD)
    return {
      verdict: 'STOP',
      reasonCodes: ['origin_avoidance_target_met'],
    };
  const originCostProjection = validateOriginCostProjection(input);
  if (!originCostProjection.ok)
    return {
      verdict: originCostProjection.verdict,
      reasonCodes: [originCostProjection.reason],
    };
  const workersLogsEvidence = validateWorkersLogsEvidence(
    input.workersLogsContract,
    input.expectedDailyWorkerInvocations,
    input.qualifiedLogEventsPerInvocation,
    input.allIngressRequests,
    input.windowDays,
    now
  );
  if (!workersLogsEvidence.ok)
    return {
      verdict: workersLogsEvidence.verdict ?? 'NOT_PROVEN',
      reasonCodes: [workersLogsEvidence.reason],
    };
  if (
    !input.currentVercelAttributionUsd ||
    !input.projectedEdgeCostUsd ||
    input.ownerApprovedPaybackMonths === undefined ||
    !input.verifiedUpfrontImplementationCostUsd
  )
    reasons.push('cost_or_approval_missing');
  if (
    input.ownerApprovedPaybackMonths !== undefined &&
    (!Number.isFinite(input.ownerApprovedPaybackMonths) ||
      input.ownerApprovedPaybackMonths < 0)
  )
    reasons.push('payback_approval_invalid');
  if (
    input.paybackMonths !== undefined &&
    (!Number.isFinite(input.paybackMonths) || input.paybackMonths < 0)
  )
    reasons.push('payback_invalid');
  if (reasons.length) return { verdict: 'NOT_PROVEN', reasonCodes: reasons };
  const current = decimalToMinorUnits(input.currentVercelAttributionUsd ?? '');
  const projected = decimalToMinorUnits(input.projectedEdgeCostUsd ?? '');
  const upfrontImplementationCost = decimalToMinorUnits(
    input.verifiedUpfrontImplementationCostUsd ?? ''
  );
  if (current === null || projected === null)
    return { verdict: 'NOT_PROVEN', reasonCodes: ['cost_input_invalid'] };
  if (upfrontImplementationCost === null)
    return {
      verdict: 'NOT_PROVEN',
      reasonCodes: ['implementation_cost_invalid'],
    };
  const projectedWithWorkersLogs =
    projected + workersLogsEvidence.projectedOverageCostMinorUnits;
  const projectedWithIrreducibleOrigin =
    projectedWithWorkersLogs + originCostProjection.dynamicMinorUnits;
  if (current <= projectedWithIrreducibleOrigin)
    return { verdict: 'STOP', reasonCodes: ['savings_not_positive'] };
  const monthlySavings = current - projectedWithIrreducibleOrigin;
  const derivedPaybackMonths =
    Number(upfrontImplementationCost) / Number(monthlySavings);
  if (!Number.isFinite(derivedPaybackMonths))
    return {
      verdict: 'NOT_PROVEN',
      reasonCodes: ['payback_calculation_invalid'],
    };
  if (
    input.ownerApprovedPaybackMonths !== undefined &&
    derivedPaybackMonths > input.ownerApprovedPaybackMonths
  )
    return {
      verdict: 'STOP',
      reasonCodes: ['payback_exceeds_approved_horizon'],
    };
  return { verdict: 'PROCEED', reasonCodes: [] };
}
