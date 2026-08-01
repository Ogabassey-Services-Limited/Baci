import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMutation,
} from './cloudflare-evidence-run-journal';
import { runMutationCommand } from './mutate-cloudflare-evidence-sources';
import { loadMutationDependencies } from './mutate-cloudflare-evidence-support';

vi.mock('./cloudflare-evidence-runner-modules', () => ({
  verifyReviewedEvidenceFile: vi.fn(async () => ({
    path: 'apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts',
    sha256: 'a'.repeat(64),
  })),
  verifyReviewedEvidenceRunnerModule: vi.fn(),
}));

const runId = '0123456789abcdef0123456789abcdef';
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
  plannedResources: [`baci-evidence-${runId}`],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mutation dependency loader', () => {
  it('does not treat a private local receipt as provider readback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    const receipt = {
      tokenId: input.writeTokenId,
      status: 'revoked',
      providerReceiptSha256: 'c'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    };
    const receiptPath = join(dir, 'revocation-receipt.json');
    await writeFile(receiptPath, JSON.stringify(receipt), { mode: 0o600 });
    await chmod(receiptPath, 0o600);
    const workspaceRoot = resolve(process.cwd());
    const commandPath = resolve(
      workspaceRoot,
      'apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts'
    );
    const originalArgv1 = process.argv[1];
    process.argv[1] = commandPath;
    vi.stubEnv('EVIDENCE_WORKSPACE_ROOT', workspaceRoot);
    vi.stubEnv(
      'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_RECEIPT_PATH',
      receiptPath
    );
    vi.stubEnv('EVIDENCE_MUTATION_RUNNER_MODULE', '');
    vi.stubEnv('CLOUDFLARE_WRITE_TOKEN', '');
    try {
      const dependencies = await loadMutationDependencies(
        runId,
        dir,
        'record_write_revocation'
      );
      expect(dependencies.revocationReceipt).toEqual(receipt);
      if (typeof dependencies.client.readBack !== 'function')
        throw new Error('readback client was not loaded');
      await expect(
        dependencies.client.readBack(input.writeTokenId)
      ).rejects.toThrow(
        'owner provisioning required: independent authenticated provider or audit readback is unavailable'
      );
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('cannot record revocation from a forged local receipt or transition the journal', async () => {
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
        status: 'absent' as const,
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'e'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    const receiptPath = join(dir, 'forged-revocation-receipt.json');
    await writeFile(
      receiptPath,
      JSON.stringify({
        tokenId: input.writeTokenId,
        status: 'revoked',
        providerReceiptSha256: 'c'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
      { mode: 0o600 }
    );
    await chmod(receiptPath, 0o600);
    const workspaceRoot = resolve(process.cwd());
    const commandPath = resolve(
      workspaceRoot,
      'apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts'
    );
    const originalArgv1 = process.argv[1];
    process.argv[1] = commandPath;
    vi.stubEnv('EVIDENCE_WORKSPACE_ROOT', workspaceRoot);
    vi.stubEnv(
      'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_RECEIPT_PATH',
      receiptPath
    );
    try {
      const dependencies = await loadMutationDependencies(
        runId,
        dir,
        'record_write_revocation'
      );
      await expect(
        runMutationCommand(
          ['--record-write-revocation', runId],
          dir,
          dependencies
        )
      ).rejects.toThrow(
        'owner provisioning required: independent authenticated provider or audit readback is unavailable'
      );
      await expect(
        loadEvidenceRunForCleanup(dir, runId)
      ).resolves.toMatchObject({ phase: 'cleanup_verified' });
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('rejects a receipt with extra fields before binding it to the journal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    const receiptPath = join(dir, 'revocation-receipt.json');
    await writeFile(
      receiptPath,
      JSON.stringify({
        tokenId: input.writeTokenId,
        status: 'revoked',
        providerReceiptSha256: 'c'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
        unexpected: true,
      }),
      { mode: 0o600 }
    );
    await chmod(receiptPath, 0o600);
    vi.stubEnv('EVIDENCE_WORKSPACE_ROOT', resolve(process.cwd()));
    vi.stubEnv(
      'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_RECEIPT_PATH',
      receiptPath
    );
    const commandPath = resolve(
      process.cwd(),
      'apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts'
    );
    const originalArgv1 = process.argv[1];
    process.argv[1] = commandPath;
    try {
      await expect(
        loadMutationDependencies(runId, dir, 'record_write_revocation')
      ).rejects.toThrow('invalid');
    } finally {
      process.argv[1] = originalArgv1;
    }
  });
});
