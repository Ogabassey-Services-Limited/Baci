import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordCleanupVerified,
  recordCleanupWriteToken,
  recordEvidenceMutation,
} from './cloudflare-evidence-run-journal';
import { runMutationCommand } from './mutate-cloudflare-evidence-sources';
import { loadMutationDependencies } from './mutate-cloudflare-evidence-support';

vi.mock('./cloudflare-evidence-runner-modules', () => ({
  verifyReviewedEvidenceFile: vi.fn(async () => ({
    path: 'apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts',
    sha256: 'a'.repeat(64),
  })),
  verifyReviewedEvidenceRunnerModule: vi.fn(
    async (
      _workspaceRoot: string,
      _toolingMergeSha: string,
      descriptor: { path: string; sha256: string }
    ) => ({
      ...descriptor,
      files: [
        { path: descriptor.path, source: await readFile(descriptor.path) },
      ],
    })
  ),
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

describe('authenticated original-token revocation recovery', () => {
  it('records the original revocation after replacement cleanup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'provider-id'
    );
    await recordCleanupWriteToken(dir, input.runId, 'replacement-write');
    await recordCleanupVerified(dir, input.runId, {
      verifyCleanup: async () => ({
        status: 'absent' as const,
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'e'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    const receipt = {
      tokenId: input.writeTokenId,
      status: 'revoked',
      providerReceiptSha256: 'c'.repeat(64),
      observedAt: '2026-07-31T00:00:01.000Z',
    };
    const receiptPath = join(dir, 'revocation-receipt.json');
    await writeFile(receiptPath, JSON.stringify(receipt), { mode: 0o600 });
    const moduleRoot = await mkdtemp(
      join(resolve(process.cwd()), '.baci-revocation-test-')
    );
    const modulePath = join(moduleRoot, 'readback.mjs');
    await writeFile(
      modulePath,
      `export const createRevocationReadbackClient = async () => ({
  readBack: async (tokenId) => ({
    tokenId,
    status: 'inactive',
    auditReceiptSha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    observedAt: '2026-07-31T00:00:01.000Z'
  })
});
`,
      { mode: 0o600 }
    );
    const moduleSha256 = createHash('sha256')
      .update(await readFile(modulePath))
      .digest('hex');
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
    vi.stubEnv('EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE', modulePath);
    vi.stubEnv(
      'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE_SHA256',
      moduleSha256
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
      ).resolves.toMatchObject({ phase: 'write_token_revoked' });
      await expect(
        loadEvidenceRunForCleanup(dir, runId)
      ).resolves.toMatchObject({
        phase: 'write_token_revoked',
        writeTokenRevocationReceipt: receipt,
        cleanupWriteTokenId: 'replacement-write',
      });
    } finally {
      process.argv[1] = originalArgv1;
      await rm(moduleRoot, { recursive: true, force: true });
    }
  });
});
