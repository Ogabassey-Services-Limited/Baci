import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  parseStrictUtcBoundary,
  STRICT_UTC_BOUNDARY_PATTERN,
  UTC_DAY_MILLISECONDS,
} from '../../../../packages/shared/src/storefront/utc-boundary';

const SHA256 = /^[a-f0-9]{64}$/;
const decimal = z.string().regex(/^\d+(?:\.\d{2})?$/);
const BigIntLike = z
  .union([
    z.bigint().nonnegative(),
    z.number().int().nonnegative().refine(Number.isSafeInteger),
    z.string().regex(/^\d+$/),
  ])
  .transform((value) => BigInt(value));
const PositiveBigIntLike = BigIntLike.refine((value) => value > 0n);
const entitlementShape = {
  plan: z.enum(['free', 'paid']),
  allowanceEvents: BigIntLike,
  allowancePeriod: z.enum(['utc_day', 'billing_month']),
  allowancePeriodStartsAt: z.string().datetime({ offset: true }),
  allowancePeriodEndsAt: z.string().datetime({ offset: true }),
  currentAllowancePeriodAllAccountEvents: BigIntLike,
  allowanceUsageSourceFingerprint: z.string().regex(SHA256),
  allowanceMaximumObservationLagSeconds: z.number().int().nonnegative(),
  allowanceObservedAt: z.string().datetime({ offset: true }),
  utcDayStartsAt: z.string().datetime({ offset: true }),
  utcDayEndsAt: z.string().datetime({ offset: true }),
  currentUtcDayAllAccountEvents: BigIntLike,
  utcDayUsageSourceFingerprint: z.string().regex(SHA256),
  utcDayMaximumObservationLagSeconds: z.number().int().nonnegative(),
  utcDayObservedAt: z.string().datetime({ offset: true }),
  overageAllowed: z.boolean(),
  overageUsdPerMillion: decimal.nullable(),
  forcedSamplingDailyThreshold: BigIntLike,
  forcedSamplingRate: z.string().regex(/^0\.\d+$/),
};
export const CloudflareWorkersLogsEntitlementSchema = z
  .object(entitlementShape)
  .strict();
export type CloudflareWorkersLogsEntitlement = z.infer<
  typeof CloudflareWorkersLogsEntitlementSchema
>;
export const CloudflareWorkersLogsPlanContractSchema =
  CloudflareWorkersLogsEntitlementSchema.extend({
    forcedSamplingDailyThreshold: PositiveBigIntLike,
    officialDocsSha256: z.string().regex(SHA256),
    authenticatedEntitlementSha256: z.string().regex(SHA256),
  }).strict();
export type CloudflareWorkersLogsPlanContract = z.infer<
  typeof CloudflareWorkersLogsPlanContractSchema
>;
const ENTITLEMENT_KEYS = Object.keys(
  CloudflareWorkersLogsEntitlementSchema.shape
) as Array<keyof CloudflareWorkersLogsEntitlement>;

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
    observedMs >= endMs ||
    nowMs < startMs ||
    nowMs >= endMs ||
    observedMs > nowMs ||
    nowMs - observedMs > maximumLagSeconds * 1000
  )
    throw new Error('Cloudflare usage observation is stale or out of period');
}

function isUtcMonthStart(value: string) {
  if (!STRICT_UTC_BOUNDARY_PATTERN.test(value)) return false;
  const parsed = parseStrictUtcBoundary(value);
  return parsed !== null && parsed.getUTCDate() === 1;
}

function nextUtcMonthStart(value: string) {
  const parsed = parseStrictUtcBoundary(value);
  if (!parsed) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1)
  );
}

function parseEntitlementReceipt(raw: string) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Cloudflare authenticated entitlement receipt is invalid');
  }
  const parseProjection = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return CloudflareWorkersLogsEntitlementSchema.safeParse(value);
    const projection = { ...(value as Record<string, unknown>) };
    // These two receipt digests are computed over the raw response separately;
    // they are not provider entitlement fields and never enter the projection.
    delete projection.officialDocsSha256;
    delete projection.authenticatedEntitlementSha256;
    return CloudflareWorkersLogsEntitlementSchema.safeParse(projection);
  };
  const direct = parseProjection(decoded);
  if (direct.success) return direct.data;
  if (
    decoded &&
    typeof decoded === 'object' &&
    'result' in decoded &&
    (decoded as { result?: unknown }).result !== undefined
  ) {
    const wrapped = parseProjection((decoded as { result: unknown }).result);
    if (wrapped.success) return wrapped.data;
  }
  throw new Error('Cloudflare authenticated entitlement receipt is invalid');
}

function assertContractMatchesEntitlement(
  contract: CloudflareWorkersLogsPlanContract,
  entitlement: CloudflareWorkersLogsEntitlement
) {
  for (const key of ENTITLEMENT_KEYS) {
    if (contract[key] !== entitlement[key])
      throw new Error(
        `Cloudflare entitlement projection drifted for ${String(key)}`
      );
  }
}

function assertUtcUsageBoundaries(
  contract: CloudflareWorkersLogsPlanContract,
  now: Date
) {
  const nowMs = now.valueOf();
  if (!Number.isFinite(nowMs))
    throw new Error('Cloudflare usage counter boundaries are invalid');
  const currentDayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const expectedDayEnd = new Date(
    currentDayStart.valueOf() + UTC_DAY_MILLISECONDS
  );
  const dayStart = parseStrictUtcBoundary(contract.utcDayStartsAt);
  const dayEnd = parseStrictUtcBoundary(contract.utcDayEndsAt);
  if (
    !dayStart ||
    !dayEnd ||
    dayStart.valueOf() !== currentDayStart.valueOf() ||
    dayEnd.valueOf() !== expectedDayEnd.valueOf()
  )
    throw new Error(
      'Cloudflare UTC-day usage boundaries are not a full current day'
    );
  if (contract.allowancePeriod === 'utc_day') {
    if (
      contract.allowancePeriodStartsAt !== contract.utcDayStartsAt ||
      contract.allowancePeriodEndsAt !== contract.utcDayEndsAt
    )
      throw new Error(
        'Cloudflare Free allowance must cover a full current UTC day'
      );
  } else {
    const start = parseStrictUtcBoundary(contract.allowancePeriodStartsAt);
    const end = parseStrictUtcBoundary(contract.allowancePeriodEndsAt);
    const expectedEnd = nextUtcMonthStart(contract.allowancePeriodStartsAt);
    if (
      !start ||
      !end ||
      !isUtcMonthStart(contract.allowancePeriodStartsAt) ||
      !isUtcMonthStart(contract.allowancePeriodEndsAt) ||
      !expectedEnd ||
      end.valueOf() !== expectedEnd.valueOf()
    )
      throw new Error(
        'Cloudflare Paid allowance must cover a full billing month'
      );
  }
}

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
  const now = options.now ?? new Date();
  assertUtcUsageBoundaries(contract, now);
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
  assertContractMatchesEntitlement(
    checked,
    parseEntitlementReceipt(entitlement)
  );
  const digest = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  if (
    checked.officialDocsSha256 !== digest(officialDocs) ||
    checked.authenticatedEntitlementSha256 !== digest(entitlement)
  )
    throw new Error('Cloudflare documentation or entitlement receipt drifted');
  return checked;
}
