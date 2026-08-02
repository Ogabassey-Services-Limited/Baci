import { z } from 'zod';
import {
  buildQualificationArtifactVersionEndpoint,
  calculateQualificationArtifactModuleListSha256,
  calculateQualificationEvidencePayloadSha256,
  matchesQualificationArtifactAuthority,
  matchesQualificationPointerCacheAuthority,
  matchesQualificationRunBindings,
  type QualificationArtifactAuthoritySchema,
  QualificationArtifactModuleListSchema,
  QualificationArtifactReadbackVersionSchema,
  QualificationArtifactReceiptSchema,
  QualificationRunBindingSchema,
  qualifyQualificationPointerCache,
} from './cloudflare-evidence-qualification-artifact';
import { QualificationControlEvidenceSchema } from './cloudflare-evidence-qualification-contracts';
import {
  hasReviewedQualificationArtifactIdentity,
  isQualificationControlEvidenceInScope,
} from './cloudflare-evidence-qualification-control-scope';
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
    /** Authenticated purge and topology receipts from the provider qualification. */
    controlEvidence: QualificationControlEvidenceSchema,
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
    artifactReceipt: QualificationArtifactReceiptSchema,
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
    expectedArtifactAuthority?: z.infer<
      typeof QualificationArtifactAuthoritySchema
    >;
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
    if (
      !options.expectedArtifactAuthority ||
      !matchesQualificationArtifactAuthority(
        expectedArtifacts,
        options.expectedArtifactAuthority,
        expectedBinding.toolingMergeSha
      )
    )
      return { ok: false, reason: 'reviewed_artifact_authority_mismatch' };
    if (
      !options.expectedArtifactAuthority ||
      !matchesQualificationPointerCacheAuthority(
        receipt.pointerCache,
        options.expectedArtifactAuthority
      )
    )
      return { ok: false, reason: 'pointer_cache_authority_mismatch' };
    if (
      calculateQualificationEvidencePayloadSha256(
        receipt,
        expectedArtifacts
      ) !== expectedBinding.measurementPayloadSha256
    )
      return { ok: false, reason: 'measurement_payload_mismatch' };
  }
  const controlAccountId =
    options.expectedAccountId ?? expectedArtifacts[0]?.accountId;
  if (
    !controlAccountId ||
    !isQualificationControlEvidenceInScope(
      receipt.controlEvidence,
      controlAccountId,
      receipt.scriptName
    )
  )
    return { ok: false, reason: 'control_evidence_scope_invalid' };
  if (
    !hasReviewedQualificationArtifactIdentity(
      expectedArtifacts,
      options.expectedScriptName,
      options.expectedAccountId
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
  const expectedAccountId =
    options.expectedAccountId ?? expectedArtifacts[0]?.accountId;
  if (!expectedAccountId)
    return { ok: false, reason: 'scripts_versions_account_mismatch' };
  if (receipt.versions[0]?.endpoint.split('/')[2] !== expectedAccountId)
    return { ok: false, reason: 'scripts_versions_account_mismatch' };
  if (
    !receipt.versions.every(
      (version) =>
        version.endpoint ===
        buildQualificationArtifactVersionEndpoint(
          expectedAccountId,
          receipt.scriptName,
          version.versionId
        )
    )
  )
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  const scriptsEndpoint = `/accounts/${expectedAccountId}/workers/scripts/${receipt.scriptName}`;
  if (receipt.deploymentsEndpoint !== `${scriptsEndpoint}/deployments`)
    return { ok: false, reason: 'deployments_endpoint_invalid' };
  if (
    receipt.versions[0].moduleSha256 === receipt.versions[1].moduleSha256 ||
    receipt.versions[0].settingsSha256 === receipt.versions[1].settingsSha256
  )
    return { ok: false, reason: 'artifacts_not_distinguishable' };
  const pointerCacheValidation = qualifyQualificationPointerCache(
    receipt.pointerCache,
    options.now ?? new Date(),
    options.maximumAgeSeconds
  );
  if (!pointerCacheValidation.fresh)
    return { ok: false, reason: 'pointer_cache_qualification_expired' };
  if (!pointerCacheValidation.fingerprintValid)
    return { ok: false, reason: 'pointer_cache_fingerprint_invalid' };
  return { ok: true, qualification: receipt };
}
export {
  PurgeContractSchema,
  TopologyEndpointSchema,
} from './cloudflare-evidence-qualification-contracts';
