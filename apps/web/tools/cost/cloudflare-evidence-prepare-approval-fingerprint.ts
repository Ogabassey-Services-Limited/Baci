import { createHash } from 'node:crypto';

type PrepareApprovalFingerprintInput = Readonly<{
  id: string;
  toolingMergeSha: string;
  policyId: string;
  policySha256: string;
  readTokenId: string;
  readPolicySha256: string;
  mutationRunnerModuleSha256: string;
  measurementRunnerModuleSha256: string;
  readRevocationRunnerModuleSha256: string;
  cleanupPolicySha256?: string;
  approvedAt: string;
  expiresAt: string;
}>;

/** Calculates the immutable owner-approval identity consumed for one evidence run. */
export function calculatePrepareApprovalFingerprint(
  approval: PrepareApprovalFingerprintInput
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: approval.id,
        toolingMergeSha: approval.toolingMergeSha,
        policyId: approval.policyId,
        policySha256: approval.policySha256,
        readTokenId: approval.readTokenId,
        readPolicySha256: approval.readPolicySha256,
        mutationRunnerModuleSha256: approval.mutationRunnerModuleSha256,
        measurementRunnerModuleSha256: approval.measurementRunnerModuleSha256,
        readRevocationRunnerModuleSha256:
          approval.readRevocationRunnerModuleSha256,
        cleanupPolicySha256: approval.cleanupPolicySha256,
        approvedAt: approval.approvedAt,
        expiresAt: approval.expiresAt,
      })
    )
    .digest('hex');
}
