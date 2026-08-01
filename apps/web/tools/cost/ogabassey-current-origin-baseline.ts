export type {
  CloudflareWorkersLogsContractValidationOptions,
  CloudflareWorkersLogsEntitlement,
  CloudflareWorkersLogsPlanContract,
} from './cloudflare-workers-logs-contract';
export {
  CloudflareWorkersLogsEntitlementSchema,
  CloudflareWorkersLogsPlanContractSchema,
  retrieveCurrentCloudflareWorkersLogsContract,
  validateCloudflareWorkersLogsPlanContract,
} from './cloudflare-workers-logs-contract';

const MILLISECONDS_PER_UTC_DAY = 86_400_000;
const CLOSED_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/;
const DEFAULT_MAXIMUM_BASELINE_AGE_DAYS = 7;
const MAXIMUM_ORIGIN_AVOIDANCE_RATE = 0.001;

function parseStrictUtcBoundary(value: string) {
  if (!CLOSED_UTC_PATTERN.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value
    ? date
    : null;
}

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
  ownerApprovedPaybackMonths?: number;
  paybackMonths?: number;
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
    7 * MILLISECONDS_PER_UTC_DAY
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
      maximumWindowAgeDays * MILLISECONDS_PER_UTC_DAY
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
  if (originAvoidanceRate <= MAXIMUM_ORIGIN_AVOIDANCE_RATE)
    return {
      verdict: 'STOP',
      reasonCodes: ['origin_avoidance_target_met'],
    };
  if (
    !input.currentVercelAttributionUsd ||
    !input.projectedEdgeCostUsd ||
    input.ownerApprovedPaybackMonths === undefined ||
    input.paybackMonths === undefined
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
  if (current === null || projected === null)
    return { verdict: 'NOT_PROVEN', reasonCodes: ['cost_input_invalid'] };
  if (current <= projected)
    return { verdict: 'STOP', reasonCodes: ['savings_not_positive'] };
  if (
    input.paybackMonths !== undefined &&
    input.ownerApprovedPaybackMonths !== undefined &&
    input.paybackMonths > input.ownerApprovedPaybackMonths
  )
    return {
      verdict: 'STOP',
      reasonCodes: ['payback_exceeds_approved_horizon'],
    };
  return { verdict: 'PROCEED', reasonCodes: [] };
}
