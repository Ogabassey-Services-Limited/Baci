import { z } from 'zod';
import { canonicalizeJson } from '../../../../packages/shared/src/storefront/delivery-evidence';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);

/** Contract facts fixed by an independently reviewed provider authority. */
export const ZeroWeightContractSchema = z
  .object({
    zeroWeightDeploymentSupported: z.literal(true),
    zeroWeightOpenApiContradiction: z.literal(true),
    productDocumentSha256: Hash,
    openApiSha256: Hash,
    openApiMinimumWeight: z.literal(0.01),
    visibilityBoundSeconds: z.number().int().positive(),
  })
  .strict();

export type CloudflareZeroWeightContract = z.infer<
  typeof ZeroWeightContractSchema
>;

export function matchesReviewedZeroWeightContract(
  proof: unknown,
  expected: unknown
) {
  const record = proof as Partial<CloudflareZeroWeightContract>;
  const parsedProof = ZeroWeightContractSchema.safeParse({
    zeroWeightDeploymentSupported: record.zeroWeightDeploymentSupported,
    zeroWeightOpenApiContradiction: record.zeroWeightOpenApiContradiction,
    productDocumentSha256: record.productDocumentSha256,
    openApiSha256: record.openApiSha256,
    openApiMinimumWeight: record.openApiMinimumWeight,
    visibilityBoundSeconds: record.visibilityBoundSeconds,
  });
  const parsedExpected = ZeroWeightContractSchema.safeParse(expected);
  if (!parsedExpected.success) return 'authority_required' as const;
  if (
    !parsedProof.success ||
    canonicalizeJson(parsedProof.data) !== canonicalizeJson(parsedExpected.data)
  )
    return 'mismatch' as const;
  return undefined;
}

export function observationsAreWithinCurrentRun(
  observations: readonly Readonly<{
    observationStartedAt: string;
    observationEndedAt: string;
  }>[],
  acceptedAtMs: number,
  nowMs: number
) {
  return observations.every((observation) => {
    const startedAtMs = Date.parse(observation.observationStartedAt);
    const endedAtMs = Date.parse(observation.observationEndedAt);
    return (
      Number.isFinite(startedAtMs) &&
      Number.isFinite(endedAtMs) &&
      startedAtMs >= acceptedAtMs &&
      endedAtMs <= nowMs
    );
  });
}

export function spansVisibilityBound(
  observation: Readonly<{
    observationStartedAt: string;
    observationEndedAt: string;
    visibilityBoundSeconds: number;
  }>
) {
  return (
    Date.parse(observation.observationEndedAt) -
      Date.parse(observation.observationStartedAt) >=
    observation.visibilityBoundSeconds * 1000
  );
}
