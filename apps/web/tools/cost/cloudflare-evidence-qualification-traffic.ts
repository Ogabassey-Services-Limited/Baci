import type { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';
import type { QualificationArtifactAuthority } from './cloudflare-evidence-qualification-authority';
import {
  type CloudflareZeroWeightContract,
  matchesReviewedZeroWeightContract,
  observationsAreWithinCurrentRun,
  spansVisibilityBound,
  ZeroWeightContractSchema,
} from './cloudflare-evidence-zero-weight-authority';
import { ZeroWeightProofSchema } from './cloudflare-evidence-zero-weight-proof-schema';

const MAXIMUM_OWNER_ACCEPTANCE_AGE_MS = 24 * 60 * 60 * 1000;

export { ZeroWeightContractSchema, ZeroWeightProofSchema };
export const ZeroWeightDeploymentTupleSchema =
  ZeroWeightProofSchema.shape.deployment;
export const OrdinaryTrafficProofSchema =
  ZeroWeightProofSchema.shape.ordinaryTraffic;
export const ProtectedOverrideProofSchema =
  ZeroWeightProofSchema.shape.protectedOverride;
export const OwnerAcceptanceSchema =
  ZeroWeightProofSchema.shape.ownerAcceptance;

export type { CloudflareZeroWeightContract };
export type CloudflareOrdinaryTrafficProof = z.infer<
  typeof OrdinaryTrafficProofSchema
>;
export type CloudflareProtectedOverrideProof = z.infer<
  typeof ProtectedOverrideProofSchema
>;
export type CloudflareOwnerAcceptance = z.infer<typeof OwnerAcceptanceSchema>;
/**
 * Resolves the owner receipt from an independently authenticated authority.
 *
 * The resolver must perform its own provider/audit readback or signed
 * attestation verification. It receives no caller-selected approval ID or
 * receipt fields, so the proof cannot choose which authority record to trust.
 */
export type CloudflareOwnerAcceptanceAuthorityResolver =
  () => CloudflareOwnerAcceptance;
export type CloudflareZeroWeightProof = z.infer<typeof ZeroWeightProofSchema>;
export type CloudflareZeroWeightDeployment = Readonly<{
  deploymentId: string;
  versions: readonly Readonly<{ versionId: string; percentage: number }>[];
}>;

/** Domain-separated digest of the exact provider deployment tuple. */
export function calculateCloudflareZeroWeightDeploymentProofSha256(
  deployment: CloudflareZeroWeightDeployment
) {
  const parsed = ZeroWeightDeploymentTupleSchema.parse(deployment);
  return calculateCanonicalSha256(
    canonicalizeJson({
      domain: 'baci:cloudflare:zero-weight-deployment:v1',
      deployment: parsed,
    })
  );
}

export function validateCloudflareZeroWeightProof(
  value: unknown,
  options: Readonly<{
    deployment: CloudflareZeroWeightDeployment;
    stableVersionId: string;
    candidateVersionId: string;
    expectedOwnerApprovalId: string;
    ownerAcceptanceAuthority: CloudflareOwnerAcceptanceAuthorityResolver;
    expectedContract: CloudflareZeroWeightContract;
    expectedRequestMatrix: QualificationArtifactAuthority['zeroWeightRequestMatrix'];
    now?: Date;
  }>
) {
  const parsed = ZeroWeightProofSchema.safeParse(value);
  if (!parsed.success)
    return { ok: false as const, reason: 'zero_weight_proof_schema_invalid' };
  const proof = parsed.data;
  const matrix = options.expectedRequestMatrix;
  if (!matrix || typeof matrix !== 'object')
    return {
      ok: false as const,
      reason: 'zero_weight_request_matrix_authority_required',
    };
  if (
    proof.ordinaryTraffic.requestSha256 !== matrix.ordinaryRequestSha256 ||
    proof.ordinaryTraffic.responseSha256 !== matrix.ordinaryResponseSha256 ||
    proof.ordinaryTraffic.requestCount !== matrix.ordinaryRequestCount ||
    proof.protectedOverride.requestSha256 !==
      matrix.protectedOverrideRequestSha256 ||
    proof.protectedOverride.responseSha256 !==
      matrix.protectedOverrideResponseSha256 ||
    proof.protectedOverride.requestCount !==
      matrix.protectedOverrideRequestCount
  )
    return {
      ok: false as const,
      reason: 'zero_weight_request_matrix_mismatch',
    };
  const contractAuthority = matchesReviewedZeroWeightContract(
    proof,
    options.expectedContract
  );
  if (contractAuthority === 'authority_required')
    return {
      ok: false as const,
      reason: 'zero_weight_contract_authority_required',
    };
  if (contractAuthority === 'mismatch')
    return { ok: false as const, reason: 'zero_weight_contract_mismatch' };
  if (
    proof.deployment.deploymentId !== options.deployment.deploymentId ||
    proof.deployment.versions.length !== options.deployment.versions.length ||
    proof.deployment.versions.some((version, index) => {
      const expected = options.deployment.versions[index];
      return (
        !expected ||
        version.versionId !== expected.versionId ||
        version.percentage !== expected.percentage
      );
    })
  )
    return { ok: false as const, reason: 'zero_weight_deployment_mismatch' };
  if (
    proof.ownerAcceptance.deploymentProofSha256 !==
    calculateCloudflareZeroWeightDeploymentProofSha256(proof.deployment)
  )
    return { ok: false as const, reason: 'owner_acceptance_mismatch' };
  const deploymentById = new Map(
    proof.deployment.versions.map((version) => [version.versionId, version])
  );
  const stable = deploymentById.get(options.stableVersionId);
  const candidate = deploymentById.get(options.candidateVersionId);
  if (
    !stable ||
    !candidate ||
    stable.percentage !== 100 ||
    candidate.percentage !== 0 ||
    deploymentById.size !== 2
  )
    return { ok: false as const, reason: 'zero_weight_deployment_invalid' };
  if (
    proof.ordinaryTraffic.aInvocationCount !==
      proof.ordinaryTraffic.requestCount ||
    proof.ordinaryTraffic.bInvocationCount !== 0
  )
    return {
      ok: false as const,
      reason: 'ordinary_traffic_b_invocations_observed',
    };
  if (proof.protectedOverride.servedVersionId !== options.candidateVersionId)
    return {
      ok: false as const,
      reason: 'protected_override_served_wrong_version',
    };
  if (
    proof.protectedOverride.versionMetadataVersionId !==
    options.candidateVersionId
  )
    return {
      ok: false as const,
      reason: 'protected_override_version_metadata_mismatch',
    };
  if (
    proof.ordinaryTraffic.visibilityBoundSeconds !==
      proof.visibilityBoundSeconds ||
    proof.protectedOverride.visibilityBoundSeconds !==
      proof.visibilityBoundSeconds
  )
    return {
      ok: false as const,
      reason: 'zero_weight_visibility_bound_invalid',
    };
  if (
    !spansVisibilityBound(proof.ordinaryTraffic) ||
    !spansVisibilityBound(proof.protectedOverride)
  )
    return {
      ok: false as const,
      reason: 'zero_weight_observation_window_invalid',
    };
  if (typeof options.ownerAcceptanceAuthority !== 'function')
    return {
      ok: false as const,
      reason: 'owner_acceptance_authority_required',
    };
  let authoritative: CloudflareOwnerAcceptance;
  try {
    authoritative = OwnerAcceptanceSchema.parse(
      options.ownerAcceptanceAuthority()
    );
  } catch {
    return {
      ok: false as const,
      reason: 'owner_acceptance_authority_invalid',
    };
  }
  if (
    authoritative.accepted !== proof.ownerAcceptance.accepted ||
    authoritative.approvalId !== proof.ownerAcceptance.approvalId ||
    authoritative.acceptedAt !== proof.ownerAcceptance.acceptedAt ||
    authoritative.receiptSha256 !== proof.ownerAcceptance.receiptSha256 ||
    authoritative.deploymentProofSha256 !==
      proof.ownerAcceptance.deploymentProofSha256 ||
    authoritative.approvalId !== options.expectedOwnerApprovalId
  )
    return { ok: false as const, reason: 'owner_acceptance_mismatch' };
  const nowMs = (options.now ?? new Date()).valueOf();
  const acceptedAtMs = new Date(authoritative.acceptedAt).valueOf();
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(acceptedAtMs) ||
    acceptedAtMs > nowMs ||
    nowMs - acceptedAtMs > MAXIMUM_OWNER_ACCEPTANCE_AGE_MS
  )
    return { ok: false as const, reason: 'owner_acceptance_stale' };
  if (
    !observationsAreWithinCurrentRun(
      [proof.ordinaryTraffic, proof.protectedOverride],
      acceptedAtMs,
      nowMs
    )
  )
    return {
      ok: false as const,
      reason: 'zero_weight_observation_not_current_run',
    };
  return { ok: true as const, proof };
}

export function qualifyCloudflareZeroWeightReadback(
  input: Readonly<{
    contract: CloudflareZeroWeightContract;
    deployment: CloudflareZeroWeightDeployment;
    ordinaryTraffic: CloudflareOrdinaryTrafficProof;
    protectedOverride: CloudflareProtectedOverrideProof;
    ownerAcceptance: CloudflareOwnerAcceptance;
    stableVersionId: string;
    candidateVersionId: string;
    expectedOwnerApprovalId: string;
    ownerAcceptanceAuthority: CloudflareOwnerAcceptanceAuthorityResolver;
    expectedContract: CloudflareZeroWeightContract;
    expectedRequestMatrix: QualificationArtifactAuthority['zeroWeightRequestMatrix'];
    now?: Date;
  }>
) {
  const proof = {
    ...input.contract,
    deployment: input.deployment,
    ordinaryTraffic: input.ordinaryTraffic,
    protectedOverride: input.protectedOverride,
    ownerAcceptance: input.ownerAcceptance,
  };
  return validateCloudflareZeroWeightProof(proof, {
    deployment: input.deployment,
    stableVersionId: input.stableVersionId,
    candidateVersionId: input.candidateVersionId,
    expectedOwnerApprovalId: input.expectedOwnerApprovalId,
    ownerAcceptanceAuthority: input.ownerAcceptanceAuthority,
    expectedContract: input.expectedContract,
    expectedRequestMatrix: input.expectedRequestMatrix,
    now: input.now,
  });
}
