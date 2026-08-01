import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import type { EvidenceRunInput } from './cloudflare-evidence-run-journal';
import { calculateCloudflareEvidenceTokenPolicySha256 } from './verify-cloudflare-evidence-token-policy';

const boundedId = z.string().min(1).max(128).regex(/^\S+$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const toolingSha = z.string().regex(/^[a-f0-9]{40}$/);
const approvalArtifactSchema = z
  .object({
    id: boundedId,
    toolingMergeSha: toolingSha,
    policyId: boundedId,
    policySha256: sha256,
    readTokenId: boundedId,
    /** Separately reviewed read-only policy fingerprint used after cleanup. */
    readPolicySha256: sha256,
    approvedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();
const reviewedPolicyArtifactSchema = z
  .object({
    id: boundedId,
    toolingMergeSha: toolingSha,
    tokenId: boundedId,
    accountId: boundedId,
    zoneId: boundedId,
    permissionGroupIds: z.array(boundedId).min(1).max(32),
    resources: z.array(boundedId).min(1).max(32),
    expiresAt: z.string().datetime({ offset: true }),
    policySha256: sha256,
  })
  .strict();

export type PrepareAuthorityInput = Pick<
  EvidenceRunInput,
  | 'approvalId'
  | 'policyId'
  | 'toolingMergeSha'
  | 'writeTokenId'
  | 'readTokenId'
  | 'readPolicySha256'
  | 'accountId'
  | 'zoneId'
>;
export type VerifiedPrepareAuthority = Readonly<{
  approvalId: string;
  policyId: string;
  policySha256: string;
  readPolicySha256: string;
}>;

export function calculateReviewedPolicySha256(
  value: Omit<
    z.infer<typeof reviewedPolicyArtifactSchema>,
    'id' | 'toolingMergeSha' | 'policySha256'
  >
) {
  return calculateCloudflareEvidenceTokenPolicySha256(value);
}

async function readAuthorityArtifact(path: string, label: string) {
  if (!isAbsolute(path))
    throw new Error(`${label} artifact path must be absolute`);
  const stat = await lstat(path).catch(() => {
    throw new Error(`${label} artifact is not readable`);
  });
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o777) !== 0o600)
    throw new Error(`${label} artifact must be a private regular file`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new Error(`${label} artifact is not valid JSON`);
  }
  return parsed;
}

/** Verifies owner approval and the reviewed policy identity before journaling any run. */
export async function verifyPrepareAuthority(
  input: PrepareAuthorityInput,
  environment: Readonly<Record<string, string | undefined>>,
  now = new Date()
): Promise<VerifiedPrepareAuthority> {
  const approvalPath = environment.EVIDENCE_APPROVAL_ARTIFACT;
  const policyPath = environment.EVIDENCE_POLICY_ARTIFACT;
  if (!approvalPath || !policyPath)
    throw new Error(
      'absolute EVIDENCE_APPROVAL_ARTIFACT and EVIDENCE_POLICY_ARTIFACT are required'
    );
  if (approvalPath === policyPath)
    throw new Error('approval and policy artifacts must be distinct');
  const [approvalValue, policyValue] = await Promise.all([
    readAuthorityArtifact(approvalPath, 'approval'),
    readAuthorityArtifact(policyPath, 'policy'),
  ]);
  const approval = approvalArtifactSchema.parse(approvalValue);
  const policy = reviewedPolicyArtifactSchema.parse(policyValue);
  if (
    input.writeTokenId === input.readTokenId ||
    approval.id !== input.approvalId ||
    approval.policyId !== input.policyId ||
    approval.toolingMergeSha !== input.toolingMergeSha ||
    approval.readTokenId !== input.readTokenId ||
    approval.readPolicySha256 !== input.readPolicySha256 ||
    policy.id !== approval.policyId ||
    policy.toolingMergeSha !== input.toolingMergeSha ||
    policy.tokenId !== input.writeTokenId ||
    policy.accountId !== input.accountId ||
    policy.zoneId !== input.zoneId ||
    policy.policySha256 !== approval.policySha256 ||
    calculateReviewedPolicySha256({
      tokenId: policy.tokenId,
      accountId: policy.accountId,
      zoneId: policy.zoneId,
      permissionGroupIds: policy.permissionGroupIds,
      resources: policy.resources,
      expiresAt: policy.expiresAt,
    }) !== policy.policySha256
  )
    throw new Error('approval and reviewed policy identities do not match');
  const nowMs = now.valueOf();
  const approvedAtMs = new Date(approval.approvedAt).valueOf();
  const expiresAtMs = new Date(approval.expiresAt).valueOf();
  const policyExpiresAtMs = new Date(policy.expiresAt).valueOf();
  if (
    ![nowMs, approvedAtMs, expiresAtMs, policyExpiresAtMs].every(
      Number.isFinite
    ) ||
    approvedAtMs > nowMs ||
    expiresAtMs <= nowMs ||
    expiresAtMs <= approvedAtMs ||
    policyExpiresAtMs <= nowMs ||
    policyExpiresAtMs > expiresAtMs ||
    policyExpiresAtMs - nowMs > 2 * 60 * 60 * 1000
  )
    throw new Error(
      'owner approval or token policy is expired or not yet effective'
    );
  return Object.freeze({
    approvalId: approval.id,
    policyId: policy.id,
    policySha256: policy.policySha256,
    readPolicySha256: approval.readPolicySha256,
  });
}
