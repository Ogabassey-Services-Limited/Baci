import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordEvidenceMutation,
} from './cloudflare-evidence-run-journal';
import {
  applyCloudflareEvidenceMutation,
  cleanupCloudflareEvidenceRun,
  parseMutationArguments,
} from './mutate-cloudflare-evidence-sources';
import {
  cleanupReceipt,
  mutationCapability,
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('parseMutationArguments', () => {
  it('requires an explicit apply run and refuses measurement modes', () => {
    expect(
      parseMutationArguments(['--run', mutationInput.runId, '--apply']).mode
    ).toBe('apply');
    expect(() =>
      parseMutationArguments(['--run', mutationInput.runId, '--measure'])
    ).toThrow('apply');
  });
});

describe('Cloudflare evidence mutation lifecycle', () => {
  it('uses an exact journaled resource without creating it again', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    const create = vi.fn();
    let resourcePresent = true;
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => mutationResource,
      get: async () => (resourcePresent ? mutationResource : null),
      create,
      probe: async () => [
        { id: 'probe-a', succeeded: true },
        { id: 'probe-b', succeeded: true },
      ],
      cleanup: async () => {
        resourcePresent = false;
        return true;
      },
      inventorySha256: async () => 'a'.repeat(64),
      ...cleanupReceipt,
    };
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).resolves.toMatchObject({ phase: 'cleanup_verified' });
    expect(create).not.toHaveBeenCalled();
    expect(
      (await loadEvidenceRunForCleanup(dir, mutationInput.runId)).probeResults
    ).toEqual(['probe-a', 'probe-b']);
  });

  it('cleans up and revokes the write token when a probe fails after creation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    let resourcePresent = false;
    const cleanup = vi.fn(async () => {
      resourcePresent = false;
      return true;
    });
    const revoke = vi.fn(async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'f'.repeat(64),
    }));
    const readBack = vi.fn(async (tokenId: string) => ({
      tokenId,
      status: 'inactive' as const,
      auditReceiptSha256: 'f'.repeat(64),
      observedAt: '2026-08-01T00:00:00.000Z',
    }));
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => null,
          get: async () => (resourcePresent ? mutationResource : null),
          create: async () => {
            resourcePresent = true;
            return { id: mutationResource.id };
          },
          probe: async () => [
            { id: 'probe-a', succeeded: false },
            { id: 'probe-b', succeeded: true },
          ],
          cleanup,
          inventorySha256: async () => 'a'.repeat(64),
          revoke,
          readBack,
        }
      )
    ).rejects.toThrow('synthetic probe did not complete');
    expect(cleanup).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('write');
    await expect(
      loadEvidenceRunForCleanup(dir, mutationInput.runId)
    ).resolves.toMatchObject({
      phase: 'write_token_revoked',
      cleanupIncomplete: true,
    });
  });

  it('still records journal cleanup when created-resource reconciliation cannot bind a resource', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    let getCalls = 0;
    const cleanup = vi.fn(async () => true);
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => null,
          get: async () => {
            getCalls += 1;
            if (getCalls === 1) return null;
            throw new Error('provider readback unavailable');
          },
          create: async () => ({ id: mutationResource.id }),
          probe: async () => [],
          cleanup,
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).rejects.toBeInstanceOf(AggregateError);
    expect(cleanup).not.toHaveBeenCalled();
    await expect(
      loadEvidenceRunForCleanup(dir, mutationInput.runId)
    ).resolves.toMatchObject({
      phase: 'cleanup_incomplete_stop',
      cleanupIncomplete: true,
    });
  });

  it('rejects a resumed resource recreated under the deterministic name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    const probe = vi.fn();
    const create = vi.fn();
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => ({
            ...mutationResource,
            id: 'resource-recreated',
          }),
          get: async () => ({ ...mutationResource, id: 'resource-recreated' }),
          create,
          probe,
          cleanup: async () => true,
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).rejects.toThrow('provider read-back');
    expect(create).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
  });

  it('rejects an exact pre-existing resource that was not journaled by apply', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    const create = vi.fn();
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => mutationResource,
          get: async () => mutationResource,
          create,
          probe: async () => [],
          cleanup: async () => true,
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).rejects.toThrow('pre-existing resource collision');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects collisions and cleanup refuses wrong identity without creating or probing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    const create = vi.fn();
    await expect(
      applyCloudflareEvidenceMutation(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => ({
            ...mutationResource,
            description: 'collision',
          }),
          get: async () => mutationResource,
          create,
          probe: async () => [
            { id: 'probe-a', succeeded: true },
            { id: 'probe-b', succeeded: true },
          ],
          cleanup: async () => true,
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).rejects.toThrow('collision');
    expect(create).not.toHaveBeenCalled();

    const cleanupDir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(cleanupDir, 0o700);
    await openEvidenceRun(cleanupDir, mutationInput);
    const cleanupCreate = vi.fn();
    const cleanupProbe = vi.fn();
    await expect(
      cleanupCloudflareEvidenceRun(
        cleanupDir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'wrong', zoneId: 'zone' }),
          findByName: async () => null,
          get: async () => mutationResource,
          create: cleanupCreate,
          probe: cleanupProbe,
          cleanup: async () => true,
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).rejects.toThrow('account');
    expect(cleanupCreate).not.toHaveBeenCalled();
    expect(cleanupProbe).not.toHaveBeenCalled();
  });
});
