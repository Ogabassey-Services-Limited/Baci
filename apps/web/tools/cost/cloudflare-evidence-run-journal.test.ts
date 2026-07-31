import { chmod, lstat, mkdtemp, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordTokenRevocation,
} from './cloudflare-evidence-run-journal';

const input = {
  runId: 'run-123',
  approvalId: 'approval',
  policyId: 'policy',
  writeTokenId: 'write',
  readTokenId: 'read',
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
      openEvidenceRun(dir, { ...input, runId: 'run-456' })
    ).rejects.toThrow('active');
    await expect(
      recordEvidencePhase(dir, input.runId, 'proof_complete')
    ).rejects.toThrow('revocation');
  });
  it('never follows traversal or symlink journal paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await expect(
      openEvidenceRun(dir, { ...input, runId: '../outside' })
    ).rejects.toThrow('invalid');
    await symlink('/tmp', join(dir, 'run-123.json'));
    await expect(loadEvidenceRunForCleanup(dir, input.runId)).rejects.toThrow(
      'regular'
    );
  });
  it('only records authenticated token-revocation receipts, never caller timestamps', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await expect(
      recordEvidencePhase(dir, input.runId, 'write_token_revoked', {
        writeTokenRevokedAt: new Date().toISOString(),
      })
    ).rejects.toThrow('receipt');
    await recordTokenRevocation(dir, input.runId, 'write', {
      tokenId: 'write',
      status: 'revoked',
      providerReceiptSha256: 'd'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    });
    expect(
      (await loadEvidenceRunForCleanup(dir, input.runId)).writeTokenRevokedAt
    ).toBe('2026-07-31T00:00:00.000Z');
  });
});
