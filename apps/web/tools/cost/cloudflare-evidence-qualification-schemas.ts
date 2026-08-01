import { z } from 'zod';
import {
  calculateQualificationArtifactModuleListSha256,
  matchesQualificationRunBindings,
  QualificationArtifactModuleListSchema,
  QualificationArtifactReadbackVersionSchema,
  QualificationRunBindingSchema,
  qualifyQualificationPointerCache,
} from './cloudflare-evidence-qualification-artifact';
import {
  type CloudflareOwnerAcceptanceAuthorityResolver,
  validateCloudflareZeroWeightProof,
  ZeroWeightProofSchema,
} from './cloudflare-evidence-qualification-traffic';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const QUALIFICATION_WORKER_NAME = 'baci-evidence-qualification';
export const QUALIFICATION_EVIDENCE_HOST = 'edge-evidence.ogabassey.com';
export const QUALIFICATION_POINTER_URL = `https://${QUALIFICATION_EVIDENCE_HOST}/__baci-evidence/a`;
export const QUALIFICATION_POINTER_PROBE_COUNT = 2;
export const PointerCacheSchema = z
  .object({
    pointerUrl: z.literal(QUALIFICATION_POINTER_URL),
    cacheRuleId: z.string().min(1),
    cacheRulesetVersion: z.string().min(1),
    traceExpressionSha256: Hash,
    acceptedCfCacheStatuses: z.array(z.literal('DYNAMIC')).length(1),
    requestCacheMode: z.literal('no-store'),
    repeatedProbeCount: z.literal(QUALIFICATION_POINTER_PROBE_COUNT),
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
    versions: z.array(QualificationArtifactReadbackVersionSchema).length(2),
    deploymentsEndpoint: z.string().min(1),
    deployments: z
      .object({
        deploymentId: z.string().min(1),
        versions: z
          .array(
            z
              .object({
                versionId: z.string().min(1),
                percentage: z.number().min(0).max(100),
              })
              .strict()
          )
          .length(2),
      })
      .strict(),
    zeroWeightProof: ZeroWeightProofSchema,
    pointerCache: PointerCacheSchema,
    runBinding: QualificationRunBindingSchema,
  })
  .strict();
export type CloudflareWorkerArtifactReadbackQualification = z.infer<
  typeof ArtifactReadbackSchema
>;
export const ReviewedQualificationArtifactSchema = z
  .object({
    accountId: z.string().min(1),
    scriptName: z.literal(QUALIFICATION_WORKER_NAME),
    versionId: z.string().min(1),
    scriptEtag: Hash,
    moduleSha256: Hash,
    modules: QualificationArtifactModuleListSchema,
    moduleListSha256: Hash,
    settingsSha256: Hash,
    artifactReceipt: z
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
      .strict(),
    runBinding: QualificationRunBindingSchema,
  })
  .strict()
  .refine(
    ({
      scriptEtag,
      modules,
      moduleListSha256,
      settingsSha256,
      artifactReceipt,
    }) =>
      artifactReceipt.bundleSha256 === scriptEtag &&
      artifactReceipt.configSha256 === settingsSha256 &&
      artifactReceipt.moduleListSha256 === moduleListSha256 &&
      moduleListSha256 ===
        calculateQualificationArtifactModuleListSha256(modules),
    'reviewed artifact provider identities must match the nested receipt'
  );
export type ReviewedQualificationArtifact = z.infer<
  typeof ReviewedQualificationArtifactSchema
>;
export { calculatePointerCacheCanonicalSha256 } from './cloudflare-evidence-qualification-artifact';
export function qualifyCloudflareEvidenceReadback(
  value: unknown,
  options: Readonly<{
    now?: Date;
    maximumAgeSeconds?: number;
    expectedArtifacts: readonly [
      ReviewedQualificationArtifact,
      ReviewedQualificationArtifact,
    ];
    expectedScriptName: string;
    expectedAccountId?: string;
    expectedOwnerApprovalId: string;
    ownerAcceptanceAuthority: CloudflareOwnerAcceptanceAuthorityResolver;
    expectedRunBinding?: z.infer<typeof QualificationRunBindingSchema>;
  }>
):
  | { ok: true; qualification: z.infer<typeof ArtifactReadbackSchema> }
  | { ok: false; reason: string } {
  const parsed = ArtifactReadbackSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: 'readback_schema_invalid' };
  const receipt = parsed.data;
  if (options.expectedScriptName !== QUALIFICATION_WORKER_NAME)
    return { ok: false, reason: 'reviewed_script_identity_required' };
  if (receipt.scriptName !== options.expectedScriptName)
    return { ok: false, reason: 'script_identity_mismatch' };
  const expectedArtifacts = options.expectedArtifacts;
  if (
    expectedArtifacts.some(
      (artifact) =>
        !ReviewedQualificationArtifactSchema.safeParse(artifact).success
    )
  )
    return { ok: false, reason: 'reviewed_artifacts_invalid' };
  if (options.expectedRunBinding) {
    const expectedBinding = options.expectedRunBinding;
    if (
      !matchesQualificationRunBindings(
        receipt.runBinding,
        expectedArtifacts.map(({ runBinding }) => runBinding),
        expectedBinding
      )
    )
      return { ok: false, reason: 'qualification_run_binding_mismatch' };
  }
  const reviewedAccountIds = new Set(
    expectedArtifacts.map(({ accountId }) => accountId)
  );
  if (
    expectedArtifacts.length !== 2 ||
    reviewedAccountIds.size !== 1 ||
    (options.expectedAccountId !== undefined &&
      !reviewedAccountIds.has(options.expectedAccountId)) ||
    new Set(expectedArtifacts.map(({ versionId }) => versionId)).size !== 2 ||
    new Set(expectedArtifacts.map(({ scriptName }) => scriptName)).size !== 1 ||
    new Set(
      expectedArtifacts.map(
        ({ artifactReceipt }) => artifactReceipt.bundleSha256
      )
    ).size !== 2 ||
    new Set(
      expectedArtifacts.map(
        ({ artifactReceipt }) => artifactReceipt.canonicalSourceSha256
      )
    ).size !== 2 ||
    expectedArtifacts.some(
      (artifact) => artifact.scriptName !== options.expectedScriptName
    )
  )
    return { ok: false, reason: 'reviewed_artifacts_invalid' };
  if (
    new Set(receipt.versions.map(({ versionId }) => versionId)).size !== 2 ||
    new Set(receipt.versions.map(({ endpoint }) => endpoint)).size !== 2
  )
    return { ok: false, reason: 'duplicate_version_identity' };
  const expectedById = new Map(
    expectedArtifacts.map((artifact) => [artifact.versionId, artifact])
  );
  if (
    receipt.versions.some((version) => {
      const expected = expectedById.get(version.versionId);
      return (
        !expected ||
        version.scriptEtag !== expected.scriptEtag ||
        version.moduleSha256 !== expected.moduleSha256 ||
        version.moduleListSha256 !==
          expected.artifactReceipt.moduleListSha256 ||
        version.settingsSha256 !== expected.settingsSha256
      );
    })
  )
    return { ok: false, reason: 'reviewed_artifact_mismatch' };
  const deploymentVersionIds = new Set(
    receipt.deployments.versions.map(({ versionId }) => versionId)
  );
  const deploymentVersionById = new Map(
    receipt.deployments.versions.map((version) => [version.versionId, version])
  );
  const deploymentA = deploymentVersionById.get(
    expectedArtifacts[0]?.versionId
  );
  const deploymentB = deploymentVersionById.get(
    expectedArtifacts[1]?.versionId
  );
  if (
    deploymentVersionIds.size !== 2 ||
    !deploymentA ||
    !deploymentB ||
    deploymentA.percentage !== 100 ||
    deploymentB.percentage !== 0
  )
    return { ok: false, reason: 'deployment_tuple_invalid' };
  const zeroWeightProof = validateCloudflareZeroWeightProof(
    receipt.zeroWeightProof,
    {
      deployment: receipt.deployments,
      stableVersionId: expectedArtifacts[0].versionId,
      candidateVersionId: expectedArtifacts[1].versionId,
      expectedOwnerApprovalId: options.expectedOwnerApprovalId,
      ownerAcceptanceAuthority: options.ownerAcceptanceAuthority,
      now: options.now,
    }
  );
  if (!zeroWeightProof.ok) return zeroWeightProof;
  const prefixMatch = receipt.versions[0]?.endpoint.match(
    /^(\/accounts\/[^/]+\/workers\/scripts\/[^/]+)\/versions\/[^/]+$/
  );
  if (!prefixMatch)
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  const prefix = prefixMatch[1];
  if (prefix.split('/').at(-1) !== receipt.scriptName)
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  const expectedAccountId =
    options.expectedAccountId ?? expectedArtifacts[0]?.accountId;
  if (!expectedAccountId || prefix.split('/')[2] !== expectedAccountId)
    return { ok: false, reason: 'scripts_versions_account_mismatch' };
  if (
    !receipt.versions.every(
      (version) =>
        version.endpoint === `${prefix}/versions/${version.versionId}`
    )
  )
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  if (receipt.deploymentsEndpoint !== `${prefix}/deployments`)
    return { ok: false, reason: 'deployments_endpoint_invalid' };
  if (
    receipt.versions[0].moduleSha256 === receipt.versions[1].moduleSha256 ||
    receipt.versions[0].settingsSha256 === receipt.versions[1].settingsSha256
  )
    return { ok: false, reason: 'artifacts_not_distinguishable' };
  const maximumAgeSeconds = options.maximumAgeSeconds ?? 24 * 60 * 60;
  const pointerCacheValidation = qualifyQualificationPointerCache(
    receipt.pointerCache,
    options.now ?? new Date(),
    maximumAgeSeconds
  );
  if (!pointerCacheValidation.fresh)
    return { ok: false, reason: 'pointer_cache_qualification_expired' };
  if (!pointerCacheValidation.fingerprintValid)
    return { ok: false, reason: 'pointer_cache_fingerprint_invalid' };
  return { ok: true, qualification: receipt };
}
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
