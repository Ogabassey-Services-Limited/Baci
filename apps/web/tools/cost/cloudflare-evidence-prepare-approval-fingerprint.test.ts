import { describe, expect, it } from 'vitest';
import { calculatePrepareApprovalFingerprint } from './cloudflare-evidence-prepare-approval-fingerprint';

const approval = {
  id: 'approval',
  toolingMergeSha: 'a'.repeat(40),
  policyId: 'policy',
  policySha256: 'b'.repeat(64),
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  mutationRunnerModuleSha256: 'd'.repeat(64),
  measurementRunnerModuleSha256: 'e'.repeat(64),
  readRevocationRunnerModuleSha256: 'f'.repeat(64),
  approvedAt: '2026-08-03T00:00:00.000Z',
  expiresAt: '2026-08-03T01:00:00.000Z',
};

describe('calculatePrepareApprovalFingerprint', () => {
  it('changes when the owner-approved recovery adapter changes', () => {
    const original = calculatePrepareApprovalFingerprint(approval);
    const changed = calculatePrepareApprovalFingerprint({
      ...approval,
      readRevocationRunnerModuleSha256: '0'.repeat(64),
    });

    expect(original).toMatch(/^[a-f0-9]{64}$/);
    expect(changed).not.toBe(original);
  });
});
