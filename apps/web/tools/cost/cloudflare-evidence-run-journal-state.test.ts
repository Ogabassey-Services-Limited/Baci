import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import {
  assertTransition,
  createCleanupVerificationReceipt,
  verifyDirectory,
} from './cloudflare-evidence-run-journal-state';

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

  it('allows prepared-to-mutation and rejects an unrelated transition', () => {
    expect(() => assertTransition(journal, 'mutated')).not.toThrow();
    expect(() => assertTransition(journal, 'write_token_revoked')).toThrow(
      'invalid evidence phase transition'
    );
  });

  it('rejects writable ancestors while accepting a sticky temporary ancestor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-evidence-state-'));
    const stateDir = join(root, 'state');
    try {
      await chmod(root, 0o770);
      await expect(verifyDirectory(stateDir)).rejects.toThrow(
        'private durable operator storage'
      );
      await chmod(root, 0o1777);
      await expect(verifyDirectory(stateDir)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
