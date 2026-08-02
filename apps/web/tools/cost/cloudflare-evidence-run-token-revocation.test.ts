import { describe, expect, it, vi } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import { createTokenRevocationOperations } from './cloudflare-evidence-run-token-revocation';

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
  phase: 'prepared' as const,
  cleanupAttempts: 0,
  readBackEvidence: [],
  probeResults: [],
  cleanupIncomplete: false,
} satisfies CloudflareEvidenceRunJournal;

function transitionFor(
  readJournal: () => Promise<CloudflareEvidenceRunJournal>
) {
  return async <T>(
    _stateDir: string,
    _runId: string,
    transition: (value: CloudflareEvidenceRunJournal) => Promise<T> | T
  ): Promise<T> => transition(await readJournal());
}

describe('cloudflare evidence token revocation operations', () => {
  it('rejects a provider response for a different token before writing the journal', async () => {
    const readJournal = vi.fn(async () => journal);
    const operations = createTokenRevocationOperations(
      readJournal,
      transitionFor(readJournal)
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
  });

  it('rejects a revocation readback whose audit receipt differs from the revoke receipt', async () => {
    const readJournal = vi.fn(async () => journal);
    const operations = createTokenRevocationOperations(
      readJournal,
      transitionFor(readJournal)
    );
    await expect(
      operations.revokeEvidenceRunToken('state', journal.runId, 'write', {
        revoke: async (tokenId) => ({
          tokenId,
          auditReceiptSha256: 'b'.repeat(64),
        }),
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive' as const,
          auditReceiptSha256: 'c'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).rejects.toThrow('readback');
  });

  it('rejects a serialized receipt when its provider readback changes the observation', async () => {
    const readJournal = vi.fn(async () => ({
      ...journal,
      phase: 'cleanup_verified' as const,
    }));
    const operations = createTokenRevocationOperations(
      readJournal,
      transitionFor(readJournal)
    );
    await expect(
      operations.recordTokenRevocation(
        'state',
        journal.runId,
        'write',
        {
          tokenId: 'write',
          status: 'revoked',
          providerReceiptSha256: 'b'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        },
        {
          readBack: async (tokenId) => ({
            tokenId,
            status: 'inactive',
            auditReceiptSha256: 'b'.repeat(64),
            observedAt: '2026-07-31T00:00:01.000Z',
          }),
        }
      )
    ).rejects.toThrow('serialized');
  });

  it('does not append a cleanup-token receipt after a terminal phase', async () => {
    const readJournal = vi.fn(async () => ({
      ...journal,
      phase: 'closed_stop' as const,
      cleanupWriteTokenId: 'cleanup-write',
    }));
    const operations = createTokenRevocationOperations(
      readJournal,
      transitionFor(readJournal)
    );
    await expect(
      operations.revokeEvidenceRunToken(
        'state',
        journal.runId,
        'cleanup_write',
        {
          revoke: async (tokenId) => ({
            tokenId,
            auditReceiptSha256: 'b'.repeat(64),
          }),
          readBack: async (tokenId) => ({
            tokenId,
            status: 'inactive' as const,
            auditReceiptSha256: 'b'.repeat(64),
            observedAt: '2026-07-31T00:00:00.000Z',
          }),
        }
      )
    ).rejects.toThrow('terminal');
  });
});
