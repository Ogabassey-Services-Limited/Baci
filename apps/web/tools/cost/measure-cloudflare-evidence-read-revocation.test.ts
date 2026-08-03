import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMeasurement,
  recordEvidenceMutation,
  recordEvidenceProbeResults,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import {
  loadReadTokenRevocationDependencies,
  recordCloudflareEvidenceReadTokenRevocation,
} from './measure-cloudflare-evidence-read-revocation';
import { parseMeasurementArguments } from './measure-cloudflare-evidence-sources';
import { measurementInput as input } from './measure-cloudflare-evidence-sources.test-fixtures';
import {
  externalReadTokenRevocationDependencies,
  reviewedProbeResults,
} from './mutate-cloudflare-evidence-test-fixtures';

afterEach(() => vi.unstubAllEnvs());

async function writeRevokedRun(options: Readonly<{ measured?: boolean }> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-read-revocation-'));
  await chmod(directory, 0o700);
  await openEvidenceRun(directory, input);
  await recordEvidenceMutation(
    directory,
    input.runId,
    input.plannedResources[0],
    'resource-id'
  );
  await recordEvidenceProbeResults(
    directory,
    input.runId,
    reviewedProbeResults(input.runId)
  );
  await recordCleanupVerified(directory, input.runId, {
    verifyCleanup: async () => ({
      status: 'absent' as const,
      inventorySha256: input.preInventorySha256,
      providerReceiptSha256: 'a'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    }),
  });
  await revokeEvidenceRunToken(directory, input.runId, 'write', {
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
  });
  if (options.measured !== false)
    await recordEvidenceMeasurement(directory, input.runId, {
      providerReceiptSha256: 'd'.repeat(64),
      payloadSha256: 'e'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    });
  return directory;
}

describe('read-token revocation receipt recovery', () => {
  it('accepts the receipt-only recovery command', () => {
    expect(
      parseMeasurementArguments(['--record-read-revocation', input.runId])
    ).toEqual({ mode: 'record-read-revocation', runId: input.runId });
  });

  it('finalizes a measured run from an external read-token receipt', async () => {
    const directory = await writeRevokedRun();
    const dependencies = externalReadTokenRevocationDependencies(
      input.readTokenId,
      '2026-07-31T00:00:01.000Z',
      'c'.repeat(64)
    );
    await expect(
      recordCloudflareEvidenceReadTokenRevocation(
        directory,
        input.runId,
        dependencies
      )
    ).resolves.toMatchObject({
      phase: 'proof_complete',
      readTokenRevocationReceipt: dependencies.revocationReceipt,
    });
  });

  it('rejects an external read-token receipt without a recorded measurement', async () => {
    const directory = await writeRevokedRun({ measured: false });
    const dependencies = externalReadTokenRevocationDependencies(
      input.readTokenId,
      '2026-07-31T00:00:01.000Z',
      'c'.repeat(64)
    );
    await expect(
      recordCloudflareEvidenceReadTokenRevocation(
        directory,
        input.runId,
        dependencies
      )
    ).rejects.toThrow('recorded measurement');
  });

  it('rejects provider credentials before loading the receipt-only authority', async () => {
    const directory = await writeRevokedRun();
    const receiptPath = join(directory, 'receipt.json');
    await writeFile(
      receiptPath,
      JSON.stringify({
        tokenId: input.readTokenId,
        status: 'revoked',
        providerReceiptSha256: 'c'.repeat(64),
        observedAt: '2026-07-31T00:00:01.000Z',
      }),
      { mode: 0o600 }
    );
    vi.stubEnv(
      'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH',
      receiptPath
    );
    vi.stubEnv('CLOUDFLARE_READ_TOKEN', 'must-not-enter');
    await expect(
      loadReadTokenRevocationDependencies(input.runId, directory)
    ).rejects.toThrow('must not receive a Cloudflare token');
  });
});
