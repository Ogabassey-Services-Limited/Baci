import { z } from 'zod';
import { canonicalizeJson } from '../../../../packages/shared/src/storefront/delivery-evidence';
import { ZeroWeightContractSchema } from './cloudflare-evidence-zero-weight-authority';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const ToolingMergeSha = z.string().regex(/^[a-f0-9]{40}$/);

export const QualificationPointerCacheAuthoritySchema = z
  .object({
    cacheRuleId: z.string().min(1),
    cacheRulesetVersion: z.string().min(1),
    traceExpressionSha256: Hash,
  })
  .strict();

export const QualificationZeroWeightRequestMatrixSchema = z
  .object({
    ordinaryRequestSha256: Hash,
    ordinaryResponseSha256: Hash,
    ordinaryRequestCount: z.number().int().positive(),
    protectedOverrideRequestSha256: Hash,
    protectedOverrideResponseSha256: Hash,
    protectedOverrideRequestCount: z.number().int().positive(),
  })
  .strict();

export const QualificationArtifactReceiptSchema = z
  .object({
    canonicalSourceSha256: Hash,
    configSha256: Hash,
    dependencyLockSha256: Hash,
    wranglerVersion: z.literal('4.115.0'),
    generatedTypeSha256: Hash,
    moduleListSha256: Hash,
    bundleSha256: Hash,
    soleVersionMetadataBinding: z.literal('CF_VERSION_METADATA'),
  })
  .strict();

const QualificationArtifactAuthorityEntrySchema = z
  .object({
    accountId: z.string().min(1),
    scriptName: z.string().min(1),
    versionId: z.string().min(1),
    scriptEtag: Hash,
    moduleSha256: Hash,
    moduleListSha256: Hash,
    settingsSha256: Hash,
    artifactReceipt: QualificationArtifactReceiptSchema,
  })
  .strict();

/** Exact artifact identities returned by the reviewed-commit authority. */
export const QualificationArtifactAuthoritySchema = z
  .object({
    toolingMergeSha: ToolingMergeSha,
    pointerCache: QualificationPointerCacheAuthoritySchema,
    /** Provider contract fingerprints fixed by the reviewed authority module. */
    zeroWeightContract: ZeroWeightContractSchema,
    zeroWeightRequestMatrix: QualificationZeroWeightRequestMatrixSchema,
    artifacts: z
      .array(QualificationArtifactAuthorityEntrySchema)
      .length(2)
      .superRefine((artifacts, context) => {
        if (new Set(artifacts.map(({ versionId }) => versionId)).size !== 2)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['versionId'],
            message: 'reviewed artifact versions must be unique',
          });
      }),
  })
  .strict();
export type QualificationArtifactAuthority = z.infer<
  typeof QualificationArtifactAuthoritySchema
>;

export function matchesQualificationPointerCacheAuthority(
  pointerCache: Readonly<{
    cacheRuleId: string;
    cacheRulesetVersion: string;
    traceExpressionSha256: string;
  }>,
  authority: QualificationArtifactAuthority
) {
  return (
    pointerCache.cacheRuleId === authority.pointerCache.cacheRuleId &&
    pointerCache.cacheRulesetVersion ===
      authority.pointerCache.cacheRulesetVersion &&
    pointerCache.traceExpressionSha256 ===
      authority.pointerCache.traceExpressionSha256
  );
}

export function matchesQualificationArtifactAuthority(
  artifacts: readonly {
    accountId: string;
    scriptName: string;
    versionId: string;
    scriptEtag: string;
    moduleSha256: string;
    moduleListSha256: string;
    settingsSha256: string;
    artifactReceipt: z.infer<typeof QualificationArtifactReceiptSchema>;
  }[],
  authority: QualificationArtifactAuthority,
  toolingMergeSha: string
) {
  if (authority.toolingMergeSha !== toolingMergeSha) return false;
  const expected = new Map(
    authority.artifacts.map((artifact) => [artifact.versionId, artifact])
  );
  return (
    artifacts.length === authority.artifacts.length &&
    artifacts.every((artifact) => {
      const reviewed = expected.get(artifact.versionId);
      return (
        reviewed !== undefined &&
        artifact.accountId === reviewed.accountId &&
        artifact.scriptName === reviewed.scriptName &&
        artifact.scriptEtag === reviewed.scriptEtag &&
        artifact.moduleSha256 === reviewed.moduleSha256 &&
        artifact.moduleListSha256 === reviewed.moduleListSha256 &&
        artifact.settingsSha256 === reviewed.settingsSha256 &&
        canonicalizeJson(artifact.artifactReceipt) ===
          canonicalizeJson(reviewed.artifactReceipt)
      );
    })
  );
}
