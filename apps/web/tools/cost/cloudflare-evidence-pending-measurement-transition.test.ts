import { describe, expect, it } from 'vitest';
import { assertPendingReadRevocationMeasurement } from './cloudflare-evidence-pending-measurement-transition';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';

const journal = {
  runId: '0123456789abcdef0123456789abcdef',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: [],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
  mutations: {},
  phase: 'write_token_revoked' as const,
  cleanupAttempts: 0,
  readBackEvidence: [],
  probeResults: [],
  cleanupIncomplete: false,
  measurementVerifiedAt: '2026-07-31T00:00:00.000Z',
  measurementReceiptSha256: 'd'.repeat(64),
  measurementPayloadSha256: 'e'.repeat(64),
} satisfies CloudflareEvidenceRunJournal;

describe('pending measurement transition', () => {
  it('accepts the complete receipt needed before read-token revocation', () => {
    expect(() => assertPendingReadRevocationMeasurement(journal)).not.toThrow();
  });

  it('rejects an incomplete measurement receipt before phase advancement', () => {
    expect(() =>
      assertPendingReadRevocationMeasurement({
        ...journal,
        measurementPayloadSha256: undefined,
      })
    ).toThrow('verified measurement receipt');
  });
});
