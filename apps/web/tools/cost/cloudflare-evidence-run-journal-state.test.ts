import { describe, expect, it } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import {
  assertTransition,
  createCleanupVerificationReceipt,
} from './cloudflare-evidence-run-journal-state';

const journal = {
  runId: '0123456789abcdef0123456789abcdef',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['resource'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
  mutations: {},
  phase: 'prepared' as const,
  cleanupAttempts: 0,
  readBackEvidence: [],
  probeResults: [],
  cleanupIncomplete: false,
} satisfies CloudflareEvidenceRunJournal;

describe('cloudflare evidence journal state helpers', () => {
  it('keeps cleanup receipt construction separate from authenticated readback', () => {
    expect(
      createCleanupVerificationReceipt(
        journal.preInventorySha256,
        '2026-07-31T00:00:00.000Z'
      )
    ).toEqual({
      status: 'absent',
      inventorySha256: journal.preInventorySha256,
      observedAt: '2026-07-31T00:00:00.000Z',
    });
  });

  it('allows only the prepared-to-mutation transition', () => {
    expect(() => assertTransition(journal, 'mutated')).not.toThrow();
    expect(() => assertTransition(journal, 'write_token_revoked')).toThrow(
      'invalid evidence phase transition'
    );
  });
});
