import { describe, expect, it, vi } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import { createTokenRevocationOperations } from './cloudflare-evidence-run-token-revocation';

const journal = {
  runId: 'run-123',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: [],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
  mutations: {},
  phase: 'prepared' as const,
  cleanupAttempts: 0,
  readBackEvidence: [],
  probeResults: [],
  cleanupIncomplete: false,
} satisfies CloudflareEvidenceRunJournal;

describe('cloudflare evidence token revocation operations', () => {
  it('rejects a provider response for a different token before writing the journal', async () => {
    const readJournal = vi.fn(async () => journal);
    const writeJournal = vi.fn(async () => undefined);
    const operations = createTokenRevocationOperations(
      readJournal,
      writeJournal
    );

    await expect(
      operations.revokeEvidenceRunToken('state', journal.runId, 'write', {
        revoke: async () => ({
          tokenId: 'wrong-token',
          auditReceiptSha256: 'b'.repeat(64),
        }),
        readBack: vi.fn(),
      })
    ).rejects.toThrow('wrong token');
    expect(writeJournal).not.toHaveBeenCalled();
  });
});
