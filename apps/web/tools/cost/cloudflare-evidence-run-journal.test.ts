import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCleanupVerificationReceipt,
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMeasurement,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordEvidenceProbeResults,
  recordTokenRevocation,
  revokeEvidenceRunToken,
  writeJournal,
} from './cloudflare-evidence-run-journal';

const runId = '0123456789abcdef0123456789abcdef';
const alternateRunId = 'abcdef0123456789abcdef0123456789';
const input = {
  runId,
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['evidence-run-123-worker'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};
describe('CloudflareEvidenceRunJournal', () => {
  it('writes an atomic private journal without a token or nonce', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'provider-id'
    );
    const journal = await loadEvidenceRunForCleanup(dir, input.runId);
    const raw = await readFile(join(dir, `${input.runId}.json`), 'utf8');
    expect(journal.mutations[input.plannedResources[0]]).toBe('provider-id');
    expect(raw).not.toContain('token"');
    expect((await lstat(join(dir, `${input.runId}.json`))).mode & 0o077).toBe(
      0
    );
  });
  it('rejects a second active run and terminal phases before both token revocations', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await expect(
      openEvidenceRun(dir, { ...input, runId: alternateRunId })
    ).rejects.toThrow('active');
    await expect(
      recordEvidencePhase(dir, input.runId, 'proof_complete')
    ).rejects.toThrow('invalid evidence phase transition');
  });
  it('rejects an unknown persisted phase before applying a transition', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    const opened = await openEvidenceRun(dir, input);
    await writeFile(
      join(dir, `${input.runId}.json`),
      JSON.stringify({ ...opened, phase: 'unknown' }),
      { mode: 0o600 }
    );
    await expect(
      recordEvidenceMutation(
        dir,
        input.runId,
        input.plannedResources[0],
        'provider-id'
      )
    ).rejects.toThrow('journal phase is invalid');
  });
  it('requires a separately approved read-policy fingerprint before journaling', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await expect(
      openEvidenceRun(dir, { ...input, readPolicySha256: 'bad' })
    ).rejects.toThrow('read policy fingerprint');
  });
  it('serializes concurrent run creation before either journal is visible', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    const results = await Promise.allSettled([
      openEvidenceRun(dir, input),
      openEvidenceRun(dir, { ...input, runId: alternateRunId }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
  });
  it('rejects reopening an existing run ID even after its journal is terminal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    const opened = await openEvidenceRun(dir, input);
    await writeJournal(dir, {
      ...opened,
      phase: 'closed_stop',
      cleanupIncomplete: true,
    });
    await expect(openEvidenceRun(dir, input)).rejects.toThrow('already exists');
  });
  it('serializes concurrent mutations so one read-modify-write cannot erase another', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    const plannedResources = ['evidence-a', 'evidence-b'];
    await openEvidenceRun(dir, { ...input, plannedResources });
    await Promise.all(
      plannedResources.map((name, index) =>
        recordEvidenceMutation(dir, input.runId, name, `provider-${index}`)
      )
    );
    expect(
      (await loadEvidenceRunForCleanup(dir, input.runId)).mutations
    ).toEqual({
      'evidence-a': 'provider-0',
      'evidence-b': 'provider-1',
    });
  });
  it('makes probe and measurement receipts append-only and idempotent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'provider-id'
    );
    const probes = ['probe-a', 'probe-b'];
    await recordEvidenceProbeResults(dir, input.runId, probes);
    await expect(
      recordEvidenceProbeResults(dir, input.runId, probes)
    ).resolves.toMatchObject({ probeResults: probes });
    await expect(
      recordEvidenceProbeResults(dir, input.runId, ['probe-c', 'probe-d'])
    ).rejects.toThrow('append-only');
    await recordCleanupVerified(dir, input.runId, {
      verifyCleanup: async () => ({
        status: 'absent',
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'c'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    await recordTokenRevocation(
      dir,
      input.runId,
      'write',
      {
        tokenId: input.writeTokenId,
        status: 'revoked',
        providerReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      },
      {
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive',
          auditReceiptSha256: 'd'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      }
    );
    const measurement = {
      providerReceiptSha256: 'e'.repeat(64),
      payloadSha256: 'f'.repeat(64),
      observedAt: '2026-07-31T00:00:01.000Z',
    };
    await recordEvidenceMeasurement(dir, input.runId, measurement);
    await expect(
      recordEvidenceMeasurement(dir, input.runId, measurement)
    ).resolves.toMatchObject({
      measurementReceiptSha256: measurement.providerReceiptSha256,
      measurementPayloadSha256: measurement.payloadSha256,
    });
    await expect(
      recordEvidenceMeasurement(dir, input.runId, {
        ...measurement,
        providerReceiptSha256: 'f'.repeat(64),
      })
    ).rejects.toThrow('append-only');
  });
  it('never follows traversal or symlink journal paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await expect(
      openEvidenceRun(dir, { ...input, runId: '../outside' })
    ).rejects.toThrow('invalid');
    await symlink('/tmp', join(dir, `${runId}.json`));
    await expect(loadEvidenceRunForCleanup(dir, input.runId)).rejects.toThrow(
      'regular'
    );
  });
  it('accepts a serialized revocation receipt only after provider readback re-verifies it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'provider-id'
    );
    await recordCleanupVerified(dir, input.runId, {
      verifyCleanup: async () => ({
        status: 'absent',
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'e'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    await expect(
      recordEvidencePhase(dir, input.runId, 'write_token_revoked')
    ).rejects.toThrow('receipt');
    await expect(
      recordTokenRevocation(
        dir,
        input.runId,
        'write',
        {
          tokenId: 'write',
          status: 'revoked',
          providerReceiptSha256: 'd'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        },
        {
          readBack: async (tokenId) => ({
            tokenId,
            status: 'inactive',
            auditReceiptSha256: 'd'.repeat(64),
            observedAt: '2026-07-31T00:00:00.000Z',
          }),
        }
      )
    ).resolves.toMatchObject({ phase: 'write_token_revoked' });
    await revokeEvidenceRunToken(dir, input.runId, 'write', {
      revoke: async (tokenId) => ({
        tokenId,
        auditReceiptSha256: 'd'.repeat(64),
      }),
      readBack: async (tokenId) => ({
        tokenId,
        status: 'inactive',
        auditReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    expect(
      (await loadEvidenceRunForCleanup(dir, input.runId)).writeTokenRevokedAt
    ).toBe('2026-07-31T00:00:00.000Z');
  });
  it('rejects the forgeable cleanup-receipt shape without provider readback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'provider-id'
    );
    const forged = createCleanupVerificationReceipt(
      input.preInventorySha256,
      '2026-07-31T00:00:00.000Z'
    );
    await expect(
      recordCleanupVerified(dir, input.runId, forged)
    ).rejects.toThrow('provider readback');
    await expect(
      recordCleanupVerified(dir, input.runId, {
        verifyCleanup: async () => ({
          status: 'absent',
          inventorySha256: input.preInventorySha256,
          providerReceiptSha256: 'not-a-provider-hash',
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).rejects.toThrow('readback');
  });
});
