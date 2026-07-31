import { z } from 'zod';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const UtcDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CountSchema = z.number().int().nonnegative();

/** Privacy-bounded, daily aggregate evidence. Raw request rows are deliberately not representable. */
export const StorefrontDeliveryDailyEvidenceSchema = z
  .object({
    utcDate: UtcDateSchema,
    hostnameInventorySha256: Sha256Schema,
    eligibilityPolicySha256: Sha256Schema,
    aliasRulesetVersion: z.string().min(1),
    wafRulesetVersion: z.string().min(1),
    workerDeploymentId: z.string().min(1),
    originOnlyVersionId: z.string().min(1),
    edgeVersionId: z.string().min(1),
    source: z.enum(['worker-analytics', 'worker-log']),
    exportedAt: z.string().datetime({ offset: true }),
    providerSamplingApplied: z.boolean(),
    maxSampleInterval: z.number().int().positive(),
    exportComplete: z.boolean(),
    invocationCountExact: z.boolean(),
    workerInvocationCount: CountSchema,
    totalDecisionCount: CountSchema,
    canonicalEligibleRequestCount: CountSchema,
    canonicalEligibleOriginAttemptCount: CountSchema,
    dynamicOriginAttemptCount: CountSchema,
    unknownOriginAttemptCount: CountSchema,
    edgeReleaseCount: CountSchema,
    edgeRejectCount: CountSchema,
    terminalCount: CountSchema,
    edgeErrorCount: CountSchema,
    aliasEligibleRequestCount: CountSchema,
    aliasEdgeRedirectCount: CountSchema,
    aliasEligibleOriginRequestCount: CountSchema,
    aliasDynamicOriginCount: CountSchema,
    rejectedMethodRequestCount: CountSchema,
    rejectedMethodOriginCount: CountSchema,
    allowedOriginRateLimitCount: CountSchema,
    sha256: Sha256Schema,
  })
  .strict();

export type StorefrontDeliveryDailyEvidence = z.infer<
  typeof StorefrontDeliveryDailyEvidenceSchema
>;
