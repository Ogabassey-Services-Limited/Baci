import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import { createEvidenceJournalTransitionOperations } from './cloudflare-evidence-run-journal-transitions';
import { REVIEWED_PROBE_CASE_IDS } from './mutate-cloudflare-evidence-probes';
import { reviewedProbeResults } from './mutate-cloudflare-evidence-test-fixtures';

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

describe('cloudflare evidence journal transition helpers', () => {
  it('delegates a mutation through the injected transition and mutates the journal', async () => {
    const current = structuredClone(journal);
    const transition = async <T>(
      _stateDir: string,
      _runId: string,
      callback: (value: CloudflareEvidenceRunJournal) => Promise<T> | T
    ) => callback(current);
    const { recordEvidenceMutation } =
      createEvidenceJournalTransitionOperations(transition);
    await recordEvidenceMutation(
      'state',
      journal.runId,
      'resource',
      'provider'
    );
    expect(current).toMatchObject({
      phase: 'mutated',
      mutations: { resource: 'provider' },
    });
  });

  it('rejects invalid mutation, phase, and replacement-token transitions', async () => {
    const current = structuredClone(journal);
    const transition = async <T>(
      _stateDir: string,
      _runId: string,
      callback: (value: CloudflareEvidenceRunJournal) => Promise<T> | T
    ) => callback(current);
    const operations = createEvidenceJournalTransitionOperations(transition);

    await expect(
      operations.recordEvidenceMutation('state', journal.runId, 'other', 'id')
    ).rejects.toThrow('resource name was not pre-journaled');
    current.mutations.resource = 'existing';
    await expect(
      operations.recordEvidenceMutation(
        'state',
        journal.runId,
        'resource',
        'replacement'
      )
    ).rejects.toThrow('journaled resource ID cannot be replaced');
    await expect(
      operations.recordEvidencePhase(
        'state',
        journal.runId,
        'write_token_revoked'
      )
    ).rejects.toThrow('token revocation requires an authenticated receipt');
    await expect(
      operations.recordEvidencePhase('state', journal.runId, 'cleanup_verified')
    ).rejects.toThrow('cleanup verification requires an authenticated receipt');
    await expect(
      operations.recordCleanupWriteToken('state', journal.runId, 'write')
    ).rejects.toThrow('cleanup replacement token must be distinct');
    await expect(
      operations.recordCleanupWriteToken('state', journal.runId, 'read')
    ).rejects.toThrow('cleanup replacement token must be distinct');
  });

  it('rejects a pending measurement phase without a verified measurement receipt', async () => {
    const current = {
      ...structuredClone(journal),
      phase: 'write_token_revoked' as const,
      writeTokenRevocationReceipt: {
        tokenId: journal.writeTokenId,
        status: 'revoked' as const,
        providerReceiptSha256: 'b'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      },
    };
    const transition = async <T>(
      _stateDir: string,
      _runId: string,
      callback: (value: CloudflareEvidenceRunJournal) => Promise<T> | T
    ) => callback(current);
    const operations = createEvidenceJournalTransitionOperations(transition);

    await expect(
      operations.recordEvidencePhase(
        'state',
        journal.runId,
        'measurement_complete_pending_read_revocation'
      )
    ).rejects.toThrow('verified measurement receipt');
  });

  it('canonicalizes reviewed probe cases and rejects arbitrary, skipped, or duplicate receipts', async () => {
    const current = structuredClone(journal);
    const transition = async <T>(
      _stateDir: string,
      _runId: string,
      callback: (value: CloudflareEvidenceRunJournal) => Promise<T> | T
    ) => callback(current);
    const operations = createEvidenceJournalTransitionOperations(transition);
    await operations.recordEvidenceMutation(
      'state',
      journal.runId,
      'resource',
      'provider'
    );
    const probes = reviewedProbeResults(journal.runId);
    await expect(
      operations.recordEvidenceProbeResults(
        'state',
        journal.runId,
        [...probes].reverse()
      )
    ).resolves.toMatchObject({ probeResults: REVIEWED_PROBE_CASE_IDS });
    await expect(
      operations.recordEvidenceProbeResults('state', journal.runId, [
        'arbitrary-a',
        'arbitrary-b',
      ] as never)
    ).rejects.toThrow('IDs');
    await expect(
      operations.recordEvidenceProbeResults('state', journal.runId, [
        probes[0],
        { ...probes[0], id: 'skipped-case' },
      ])
    ).rejects.toThrow('reviewed matrix');
    await expect(
      operations.recordEvidenceProbeResults('state', journal.runId, [
        probes[0],
        { ...probes[1], id: probes[0].id },
      ])
    ).rejects.toThrow('unique');
  });
});
