import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
} from './cloudflare-evidence-run-journal';
import { applyCloudflareEvidenceMutation } from './mutate-cloudflare-evidence-sources';
import {
  mutationCapability,
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

async function createRun() {
  const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
  await chmod(dir, 0o700);
  await openEvidenceRun(dir, mutationInput);
  return dir;
}

describe('ambiguous create recovery', () => {
  it.each([
    ['unreadable', async () => null],
    [
      'wrong binding',
      async () => ({
        ...mutationResource,
        temporaryRule: {
          ...mutationResource.temporaryRule,
          action: 'redirect',
        },
      }),
    ],
  ])('reconciles a created resource when immediate read-back is %s', async (_label, readBack) => {
    const dir = await createRun();
    let present = false;
    const cleanup = vi.fn(async () => {
      present = false;
      return true;
    });
    const revoke = vi.fn(async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'f'.repeat(64),
    }));
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => null,
      get: async () => (present ? readBack() : null),
      create: async () => {
        present = true;
        return { id: mutationResource.id };
      },
      probe: async () => [],
      cleanup,
      inventorySha256: async () => 'a'.repeat(64),
      revoke,
      readBack: async (tokenId: string) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: 'f'.repeat(64),
        observedAt: '2026-08-01T00:00:00.000Z',
      }),
    };
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).rejects.toThrow();
    expect(cleanup).toHaveBeenCalledWith(
      mutationResource.name,
      mutationResource.id
    );
    await expect(
      loadEvidenceRunForCleanup(dir, mutationInput.runId)
    ).resolves.toMatchObject({
      phase: 'write_token_revoked',
      cleanupIncomplete: true,
    });
  });
});
