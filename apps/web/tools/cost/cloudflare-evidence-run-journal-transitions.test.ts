import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import { createEvidenceJournalTransitionOperations } from './cloudflare-evidence-run-journal-transitions';

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

describe('cloudflare evidence journal transition helpers', () => {
  it('serializes a mutation through the injected journal transition', async () => {
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
});
