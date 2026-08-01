import { z } from 'zod';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmpty = z.string().min(1);

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
  })
  .strict();

export const OwnerAcceptanceSchema = z
  .object({
    accepted: z.literal(true),
    approvalId: NonEmpty,
    acceptedAt: z.string().datetime({ offset: true }),
    receiptSha256: Hash,
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
export type CloudflareZeroWeightProof = z.infer<typeof ZeroWeightProofSchema>;
export type CloudflareZeroWeightDeployment = Readonly<{
  deploymentId: string;
  versions: readonly Readonly<{ versionId: string; percentage: number }>[];
}>;

export function validateCloudflareZeroWeightProof(
  value: unknown,
  options: Readonly<{
    deployment: CloudflareZeroWeightDeployment;
    stableVersionId: string;
    candidateVersionId: string;
    expectedOwnerApprovalId?: string;
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
    proof.ordinaryTraffic.visibilityBoundSeconds >
      proof.visibilityBoundSeconds ||
    proof.protectedOverride.visibilityBoundSeconds >
      proof.visibilityBoundSeconds
  )
    return {
      ok: false as const,
      reason: 'zero_weight_visibility_bound_invalid',
    };
  if (
    options.expectedOwnerApprovalId !== undefined &&
    proof.ownerAcceptance.approvalId !== options.expectedOwnerApprovalId
  )
    return { ok: false as const, reason: 'owner_acceptance_mismatch' };
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
    expectedOwnerApprovalId?: string;
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
  });
}
