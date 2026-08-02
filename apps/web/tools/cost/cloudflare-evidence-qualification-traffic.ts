import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmpty = z.string().min(1);
const ProviderTimestamp = z.string().datetime({ offset: true });
const MAXIMUM_OWNER_ACCEPTANCE_AGE_MS = 24 * 60 * 60 * 1000;

export const ZeroWeightDeploymentTupleSchema = z
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

export const OrdinaryTrafficProofSchema = z
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
export const ProtectedOverrideProofSchema = z
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
export const OwnerAcceptanceSchema = z
  .object({
    accepted: z.literal(true),
    approvalId: NonEmpty,
    acceptedAt: z.string().datetime({ offset: true }),
    receiptSha256: Hash,
    /** Canonical digest of the exact deployment tuple the owner accepted. */
    deploymentProofSha256: Hash,
  })
  .strict();

export const ZeroWeightProofSchema = z
  .object({
    zeroWeightDeploymentSupported: z.literal(true),
    zeroWeightOpenApiContradiction: z.literal(true),
    productDocumentSha256: Hash,
    openApiSha256: Hash,
    openApiMinimumWeight: z.literal(0.01),
    visibilityBoundSeconds: z.number().int().positive(),
    deployment: ZeroWeightDeploymentTupleSchema,
    ordinaryTraffic: OrdinaryTrafficProofSchema,
    protectedOverride: ProtectedOverrideProofSchema,
    ownerAcceptance: OwnerAcceptanceSchema,
  })
  .strict();

export type CloudflareZeroWeightContract = z.infer<
  typeof ZeroWeightContractSchema
>;
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

function spansVisibilityBound(
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

/**
 * Hashes only the provider deployment tuple, with a domain-separated preimage.
 *
 * The owner acceptance is intentionally bound to the exact deployment
 * readback, rather than to the complete proof (which would be circular) or to
 * an approval ID that could be replayed against a different deployment.
 */
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
    now?: Date;
  }>
) {
  const parsed = ZeroWeightProofSchema.safeParse(value);
  if (!parsed.success)
    return { ok: false as const, reason: 'zero_weight_proof_schema_invalid' };
  const proof = parsed.data;
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
    now: input.now,
  });
}
