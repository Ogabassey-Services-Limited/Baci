import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import { createEvidenceJournalTransitionOperations } from './cloudflare-evidence-run-journal-transitions';

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
});
