import { z } from 'zod';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);

export const PointerCacheSchema = z
  .object({
    cacheRuleId: z.string().min(1),
    cacheRulesetVersion: z.string().min(1),
    traceExpressionSha256: Hash,
    acceptedCfCacheStatuses: z.array(z.enum(['DYNAMIC', 'BYPASS'])).min(1),
    requestCacheMode: z.literal('no-store'),
    repeatedProbeCount: z.number().int().min(2),
    ageObserved: z.literal(false),
    hitObserved: z.literal(false),
    missObserved: z.literal(false),
    qualifiedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    canonicalSha256: Hash,
  })
  .strict();

export const ArtifactReadbackSchema = z
  .object({
    apiFamily: z.literal('scripts-versions'),
    scriptName: z.string().min(1),
    versions: z
      .array(
        z
          .object({
            versionId: z.string().min(1),
            endpoint: z.string().min(1),
            scriptEtag: Hash,
            moduleSha256: Hash,
            settingsSha256: Hash,
          })
          .strict()
      )
      .length(2),
    deploymentsEndpoint: z.string().min(1),
    pointerCache: PointerCacheSchema,
  })
  .strict();

export const PurgeContractSchema = z
  .object({
    endpoint: z.string().regex(/^\/zones\/[^/]+\/purge_cache$/),
    requestSchemaSha256: Hash,
    rateLimitFingerprint: Hash,
    policySha256: Hash,
    productionResourceState: z.enum([
      'present_verified',
      'absent_requires_bootstrap',
    ]),
  })
  .strict();

export const TopologyEndpointSchema = z
  .object({
    family: z.enum(['worker-custom-domain', 'r2-cors', 'r2-custom-domain']),
    endpoint: z.string().startsWith('/accounts/'),
    requestSchemaSha256: Hash,
    responseSchemaSha256: Hash,
    maximumVisibilitySeconds: z.number().int().positive(),
  })
  .strict();
