import { z } from 'zod';
import { ZeroWeightContractSchema } from './cloudflare-evidence-zero-weight-authority';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmpty = z.string().min(1);
const ProviderTimestamp = z.string().datetime({ offset: true });
const Deployment = z
  .object({
    deploymentId: NonEmpty,
    versions: z
      .array(
        z
          .object({
            versionId: NonEmpty,
            percentage: z.number().min(0).max(100),
          })
          .strict()
      )
      .length(2),
  })
  .strict();
const OrdinaryTraffic = z
  .object({
    requestSha256: Hash,
    responseSha256: Hash,
    requestCount: z.number().int().positive(),
    aInvocationCount: z.number().int().nonnegative(),
    bInvocationCount: z.number().int().nonnegative(),
    visibilityBoundSeconds: z.number().int().positive(),
    observationStartedAt: ProviderTimestamp,
    observationEndedAt: ProviderTimestamp,
  })
  .strict();
const ProtectedOverride = z
  .object({
    requestSha256: Hash,
    responseSha256: Hash,
    requestCount: z.number().int().positive(),
    servedVersionId: NonEmpty,
    versionMetadataVersionId: NonEmpty,
    visibilityBoundSeconds: z.number().int().positive(),
    observationStartedAt: ProviderTimestamp,
    observationEndedAt: ProviderTimestamp,
  })
  .strict();
const OwnerAcceptance = z
  .object({
    accepted: z.literal(true),
    approvalId: NonEmpty,
    acceptedAt: z.string().datetime({ offset: true }),
    receiptSha256: Hash,
    deploymentProofSha256: Hash,
  })
  .strict();

/** Closed provider proof schema; component schemas are exposed through its shape. */
export const ZeroWeightProofSchema = ZeroWeightContractSchema.extend({
  deployment: Deployment,
  ordinaryTraffic: OrdinaryTraffic,
  protectedOverride: ProtectedOverride,
  ownerAcceptance: OwnerAcceptance,
}).strict();
