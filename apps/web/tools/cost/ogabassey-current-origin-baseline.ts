import { createHash } from 'node:crypto';
import { z } from 'zod';

const SHA256 = /^[a-f0-9]{64}$/;
const decimal = z.string().regex(/^\d+(?:\.\d{2})?$/);

export const CloudflareWorkersLogsPlanContractSchema = z
  .object({
    plan: z.enum(['free', 'paid']),
    allowanceEvents: z.bigint().nonnegative(),
    allowancePeriod: z.enum(['utc_day', 'billing_month']),
    allowancePeriodStartsAt: z.string().datetime({ offset: true }),
    allowancePeriodEndsAt: z.string().datetime({ offset: true }),
    currentAllowancePeriodAllAccountEvents: z.bigint().nonnegative(),
    allowanceUsageSourceFingerprint: z.string().regex(SHA256),
    allowanceMaximumObservationLagSeconds: z.number().int().nonnegative(),
    allowanceObservedAt: z.string().datetime({ offset: true }),
    utcDayStartsAt: z.string().datetime({ offset: true }),
    utcDayEndsAt: z.string().datetime({ offset: true }),
    currentUtcDayAllAccountEvents: z.bigint().nonnegative(),
    utcDayUsageSourceFingerprint: z.string().regex(SHA256),
    utcDayMaximumObservationLagSeconds: z.number().int().nonnegative(),
    utcDayObservedAt: z.string().datetime({ offset: true }),
    overageAllowed: z.boolean(),
    overageUsdPerMillion: decimal.nullable(),
    forcedSamplingDailyThreshold: z.bigint().positive(),
    forcedSamplingRate: z.string().regex(/^0\.\d+$/),
    officialDocsSha256: z.string().regex(SHA256),
    authenticatedEntitlementSha256: z.string().regex(SHA256),
  })
  .strict();

export type CloudflareWorkersLogsPlanContract = z.infer<
  typeof CloudflareWorkersLogsPlanContractSchema
>;

export type CloudflareWorkersLogsContractValidationOptions = Readonly<{
  now?: Date;
}>;

function requireCurrentObservation(
  observedAt: string,
  periodStart: string,
  periodEnd: string,
  maximumLagSeconds: number,
  now: Date
) {
  const observedMs = new Date(observedAt).valueOf();
  const startMs = new Date(periodStart).valueOf();
  const endMs = new Date(periodEnd).valueOf();
  const nowMs = now.valueOf();
  if (
    ![observedMs, startMs, endMs, nowMs].every(Number.isFinite) ||
    observedMs < startMs ||
    observedMs > endMs ||
    nowMs < startMs ||
    nowMs > endMs ||
    observedMs > nowMs ||
    nowMs - observedMs > maximumLagSeconds * 1000
  )
    throw new Error('Cloudflare usage observation is stale or out of period');
}

/** Rejects pricing, period, and forced-sampling drift from the approved public contract. */
export function validateCloudflareWorkersLogsPlanContract(
  value: unknown,
  options: CloudflareWorkersLogsContractValidationOptions = {}
): CloudflareWorkersLogsPlanContract {
  const contract = CloudflareWorkersLogsPlanContractSchema.parse(value);
  const expectedFree =
    contract.plan === 'free' &&
    contract.allowanceEvents === 200_000n &&
    contract.allowancePeriod === 'utc_day' &&
    !contract.overageAllowed &&
    contract.overageUsdPerMillion === null;
  const expectedPaid =
    contract.plan === 'paid' &&
    contract.allowanceEvents === 20_000_000n &&
    contract.allowancePeriod === 'billing_month' &&
    contract.overageAllowed &&
    contract.overageUsdPerMillion === '0.60';
  if (!expectedFree && !expectedPaid)
    throw new Error('Cloudflare Workers Logs allowance contract drifted');
  if (
    contract.forcedSamplingDailyThreshold !== 5_000_000_000n ||
    contract.forcedSamplingRate !== '0.01'
  )
    throw new Error('Cloudflare forced-sampling contract drifted');
  if (
    new Date(contract.allowancePeriodStartsAt) >=
      new Date(contract.allowancePeriodEndsAt) ||
    new Date(contract.utcDayStartsAt) >= new Date(contract.utcDayEndsAt)
  )
    throw new Error('Cloudflare usage counter boundaries are invalid');
  const now = options.now ?? new Date();
  requireCurrentObservation(
    contract.allowanceObservedAt,
    contract.allowancePeriodStartsAt,
    contract.allowancePeriodEndsAt,
    contract.allowanceMaximumObservationLagSeconds,
    now
  );
  requireCurrentObservation(
    contract.utcDayObservedAt,
    contract.utcDayStartsAt,
    contract.utcDayEndsAt,
    contract.utcDayMaximumObservationLagSeconds,
    now
  );
  return contract;
}

export async function retrieveCurrentCloudflareWorkersLogsContract(
  fetchOfficialDocs: () => Promise<string>,
  fetchAuthenticatedEntitlement: () => Promise<string>,
  contract: unknown,
  options: CloudflareWorkersLogsContractValidationOptions = {}
): Promise<CloudflareWorkersLogsPlanContract> {
  const [officialDocs, entitlement] = await Promise.all([
    fetchOfficialDocs(),
    fetchAuthenticatedEntitlement(),
  ]);
  const checked = validateCloudflareWorkersLogsPlanContract(contract, options);
  const digest = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  if (
    checked.officialDocsSha256 !== digest(officialDocs) ||
    checked.authenticatedEntitlementSha256 !== digest(entitlement)
  )
    throw new Error('Cloudflare documentation or entitlement receipt drifted');
  return checked;
}

export type OgabasseyOriginBusinessCaseInput = {
  windowDays: number;
  allIngressRequests?: number;
  allIngressOriginAttempts?: number;
  discoveredHostnames: readonly string[];
  completeHostEvidence: boolean;
  currentVercelAttributionUsd?: string;
  projectedEdgeCostUsd?: string;
  ownerApprovedPaybackMonths?: number;
  paybackMonths?: number;
};

function decimalToMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

/** Gates design work on a complete, current, all-ingress baseline—not a percentage claim. */
export function evaluateOgabasseyOriginBusinessCase(
  input: OgabasseyOriginBusinessCaseInput
): {
  verdict: 'PROCEED' | 'STOP' | 'NOT_PROVEN';
  reasonCodes: readonly string[];
} {
  const reasons: string[] = [];
  if (
    input.windowDays !== 7 ||
    !Number.isInteger(input.allIngressRequests) ||
    !Number.isInteger(input.allIngressOriginAttempts) ||
    (input.allIngressRequests ?? 0) <= 0
  )
    reasons.push('baseline_not_current_all_ingress');
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
  if (current === null || projected === null || current <= projected)
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
