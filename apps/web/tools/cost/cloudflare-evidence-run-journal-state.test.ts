import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import {
  assertTerminalPrerequisites,
  assertTransition,
  createCleanupVerificationReceipt,
  verifyDirectory,
} from './cloudflare-evidence-run-journal-state';
import { REVIEWED_PROBE_CASE_IDS } from './mutate-cloudflare-evidence-probes';

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
  const terminalJournal = {
    ...journal,
    phase: 'read_token_revoked' as const,
    mutations: { resource: 'provider' },
    probeResults: [...REVIEWED_PROBE_CASE_IDS],
    cleanupVerifiedAt: '2026-07-31T00:00:00.000Z',
    cleanupVerificationReceiptSha256: 'b'.repeat(64),
    measurementVerifiedAt: '2026-07-31T00:00:01.000Z',
    measurementReceiptSha256: 'c'.repeat(64),
    measurementPayloadSha256: 'd'.repeat(64),
    writeTokenRevocationReceipt: {
      tokenId: 'write',
      status: 'revoked' as const,
      providerReceiptSha256: 'e'.repeat(64),
      observedAt: '2026-07-31T00:00:02.000Z',
    },
    readTokenRevocationReceipt: {
      tokenId: 'read',
      status: 'revoked' as const,
      providerReceiptSha256: 'f'.repeat(64),
      observedAt: '2026-07-31T00:00:03.000Z',
    },
  } satisfies CloudflareEvidenceRunJournal;

  it('enforces terminal evidence receipts directly', () => {
    expect(() =>
      assertTerminalPrerequisites(terminalJournal, 'proof_complete')
    ).not.toThrow();
    expect(() =>
      assertTerminalPrerequisites(
        { ...terminalJournal, writeTokenRevocationReceipt: undefined },
        'proof_complete'
      )
    ).toThrow('terminal evidence phase requires verified token revocation');
    expect(() =>
      assertTerminalPrerequisites(
        { ...terminalJournal, readTokenRevocationReceipt: undefined },
        'proof_complete'
      )
    ).toThrow('terminal evidence phase requires verified token revocation');
    expect(() =>
      assertTerminalPrerequisites(
        {
          ...terminalJournal,
          readTokenRevocationReceipt: {
            ...terminalJournal.readTokenRevocationReceipt,
            tokenId: 'forged',
          },
        },
        'proof_complete'
      )
    ).toThrow('terminal evidence phase requires verified token revocation');
  });

  it('rejects terminal evidence with arbitrary reviewed-probe IDs', () => {
    expect(() =>
      assertTerminalPrerequisites(
        { ...terminalJournal, probeResults: ['probe-a', 'probe-b'] },
        'proof_complete'
      )
    ).toThrow(
      'proof_complete requires cleanup, probes, measurement, and revocation'
    );
  });

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
