import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { type FileHandle, lstat, open } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { readAuthorityArtifact } from './cloudflare-evidence-authority-file';
import {
  assertAuthorityAncestorsUnchanged,
  captureAuthorityAncestors,
} from './cloudflare-evidence-authority-path';
import type { EvidenceRunInput } from './cloudflare-evidence-run-journal';
import { calculateCloudflareEvidenceTokenPolicySha256 } from './verify-cloudflare-evidence-token-policy';

const boundedId = z.string().min(1).max(128).regex(/^\S+$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const toolingSha = z.string().regex(/^[a-f0-9]{40}$/);
const runId = z.string().regex(/^[a-f0-9]{32}$/);
const approvalArtifactSchema = z
  .object({
    id: boundedId,
    toolingMergeSha: toolingSha,
    policyId: boundedId,
    policySha256: sha256,
    readTokenId: boundedId,
    /** Separately reviewed read-only policy fingerprint used after cleanup. */
    readPolicySha256: sha256,
    /** Optional separately approved cleanup-only replacement policy fingerprint. */
    cleanupPolicySha256: sha256.optional(),
    approvedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
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
    expiresAt: z.iso.datetime({ offset: true }),
    policySha256: sha256,
  })
  .strict();
const approvalConsumptionSchema = z
  .object({
    approvalFingerprint: sha256,
    approvalId: boundedId,
    runId,
    stateDir: z.string().min(1).optional(),
  })
  .strict();

export type PrepareAuthorityInput = Pick<
  EvidenceRunInput,
  | 'runId'
  | 'approvalId'
  | 'policyId'
  | 'toolingMergeSha'
  | 'writeTokenId'
  | 'readTokenId'
  | 'readPolicySha256'
  | 'cleanupPolicySha256'
  | 'accountId'
  | 'zoneId'
>;
export type VerifiedPrepareAuthority = Readonly<{
  approvalId: string;
  policyId: string;
  policySha256: string;
  readPolicySha256: string;
  cleanupPolicySha256?: string;
}>;
export function calculateReviewedPolicySha256(
  value: Omit<
    z.infer<typeof reviewedPolicyArtifactSchema>,
    'id' | 'toolingMergeSha' | 'policySha256'
  >
) {
  return calculateCloudflareEvidenceTokenPolicySha256(value);
}
export { readAuthorityArtifact } from './cloudflare-evidence-authority-file';

function approvalFingerprint(approval: z.infer<typeof approvalArtifactSchema>) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: approval.id,
        toolingMergeSha: approval.toolingMergeSha,
        policyId: approval.policyId,
        policySha256: approval.policySha256,
        readTokenId: approval.readTokenId,
        readPolicySha256: approval.readPolicySha256,
        cleanupPolicySha256: approval.cleanupPolicySha256,
        approvedAt: approval.approvedAt,
        expiresAt: approval.expiresAt,
      })
    )
    .digest('hex');
}
async function consumeApproval(
  approvalPath: string,
  approval: z.infer<typeof approvalArtifactSchema>,
  input: PrepareAuthorityInput,
  stateDir: string | undefined
) {
  const scope = resolve(dirname(approvalPath));
  const fingerprint = approvalFingerprint(approval);
  const markerPath = join(
    scope,
    `.baci-evidence-approval-${fingerprint}.consumed`
  );
  const scopeStat = await lstat(scope).catch(() => {
    throw new Error('approval authority scope is not readable');
  });
  if (
    scopeStat.isSymbolicLink() ||
    !scopeStat.isDirectory() ||
    (Number(scopeStat.mode) & 0o077) !== 0
  )
    throw new Error('approval authority scope is not private durable storage');
  const ancestors = await captureAuthorityAncestors(
    markerPath,
    'approval consumption'
  );
  let handle: FileHandle;
  try {
    handle = await open(
      markerPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw new Error('approval consumption record could not be created');
    let existing: z.infer<typeof approvalConsumptionSchema>;
    try {
      existing = approvalConsumptionSchema.parse(
        await readAuthorityArtifact(markerPath, 'approval consumption')
      );
    } catch {
      throw new Error('approval consumption record is invalid');
    }
    if (
      existing.approvalFingerprint !== fingerprint ||
      existing.approvalId !== approval.id ||
      existing.runId !== input.runId ||
      existing.stateDir !== stateDir
    )
      throw new Error('approval is already consumed for another run');
    return;
  }
  try {
    await assertAuthorityAncestorsUnchanged(
      markerPath,
      'approval consumption',
      ancestors
    );
    await handle.writeFile(
      `${JSON.stringify({
        approvalFingerprint: fingerprint,
        approvalId: approval.id,
        runId: input.runId,
        ...(stateDir ? { stateDir } : {}),
      })}\n`
    );
    await handle.sync();
  } catch {
    throw new Error('approval consumption record could not be persisted');
  } finally {
    await handle.close().catch(() => undefined);
  }
  let scopeHandle: FileHandle | undefined;
  try {
    scopeHandle = await open(scope, constants.O_RDONLY);
    await scopeHandle.sync();
  } catch {
    throw new Error('approval consumption record could not be persisted');
  } finally {
    await scopeHandle?.close().catch(() => undefined);
  }
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
  const approvalScope = resolve(dirname(approvalPath));
  const policyScope = resolve(dirname(policyPath));
  if (approvalScope !== policyScope)
    throw new Error('approval and policy artifacts must share authority scope');
  const stateDir = environment.EVIDENCE_RUN_STATE_DIR;
  if (stateDir !== undefined && !isAbsolute(stateDir))
    throw new Error('EVIDENCE_RUN_STATE_DIR must be absolute');
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
    approval.cleanupPolicySha256 !== input.cleanupPolicySha256 ||
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
  await consumeApproval(approvalPath, approval, input, stateDir);
  return Object.freeze({
    approvalId: approval.id,
    policyId: policy.id,
    policySha256: policy.policySha256,
    readPolicySha256: approval.readPolicySha256,
    ...(approval.cleanupPolicySha256
      ? { cleanupPolicySha256: approval.cleanupPolicySha256 }
      : {}),
  });
}
