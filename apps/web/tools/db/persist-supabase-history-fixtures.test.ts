import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import { persistSupabaseHistoryFixtures } from './persist-supabase-history-fixtures';
import type { ReplayOutput } from './replay-repository-root';

const roots: string[] = [];

type ReplayOutputMock = ReplayOutput & {
  create: Mock<ReplayOutput['create']>;
  read: Mock<ReplayOutput['read']>;
  remove: Mock<ReplayOutput['remove']>;
  replace: Mock<ReplayOutput['replace']>;
};

async function output(
  name: string,
  existing?: string
): Promise<ReplayOutputMock> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-fixture-persist-'));
  roots.push(root);
  const target = path.join(root, name);
  if (existing !== undefined) await writeFile(target, existing);
  return {
    create: vi.fn<ReplayOutput['create']>().mockResolvedValue(undefined),
    path: target,
    read: vi.fn<ReplayOutput['read']>(async (encoding?: BufferEncoding) =>
      encoding === undefined ? Buffer.from(existing ?? '') : (existing ?? '')
    ),
    remove: vi.fn<ReplayOutput['remove']>().mockResolvedValue(undefined),
    replace: vi.fn<ReplayOutput['replace']>().mockResolvedValue(undefined),
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('persistSupabaseHistoryFixtures', () => {
  it('creates both fixtures only when neither output exists', async () => {
    const linkedOutput = await output('linked.json');
    const effectsOutput = await output('effects.json');
    await persistSupabaseHistoryFixtures({
      effectsBody: 'effects',
      effectsOutput,
      linkedBody: 'linked',
      linkedOutput,
      mode: 'create',
    });
    expect(linkedOutput.create).toHaveBeenCalledWith('linked', { mode: 0o600 });
    expect(effectsOutput.create).toHaveBeenCalledWith('effects', {
      mode: 0o600,
    });
    expect(effectsOutput.replace).not.toHaveBeenCalled();
  });

  it('removes the linked fixture when effects fixture creation fails', async () => {
    const linkedOutput = await output('linked.json');
    const effectsOutput = await output('effects.json');
    const createFailure = new Error('effects create failed');
    effectsOutput.create.mockRejectedValue(createFailure);

    await expect(
      persistSupabaseHistoryFixtures({
        effectsBody: 'effects',
        effectsOutput,
        linkedBody: 'linked',
        linkedOutput,
        mode: 'create',
      })
    ).rejects.toBe(createFailure);
    expect(linkedOutput.remove).toHaveBeenCalledOnce();
  });

  it('reports both failures when linked fixture rollback fails', async () => {
    const linkedOutput = await output('linked.json');
    const effectsOutput = await output('effects.json');
    const createFailure = new Error('effects create failed');
    const rollbackFailure = new Error('linked rollback failed');
    effectsOutput.create.mockRejectedValue(createFailure);
    linkedOutput.remove.mockRejectedValue(rollbackFailure);

    await expect(
      persistSupabaseHistoryFixtures({
        effectsBody: 'effects',
        effectsOutput,
        linkedBody: 'linked',
        linkedOutput,
        mode: 'create',
      })
    ).rejects.toMatchObject({
      errors: [createFailure, rollbackFailure],
      message: 'Captured replay fixture rollback failed',
    });
  });

  it('verifies both fixtures without writing', async () => {
    const linkedOutput = await output('linked.json', 'linked');
    const effectsOutput = await output('effects.json', 'effects');
    await persistSupabaseHistoryFixtures({
      effectsBody: 'effects',
      effectsOutput,
      linkedBody: 'linked',
      linkedOutput,
      mode: 'verify',
    });
    expect(linkedOutput.create).not.toHaveBeenCalled();
    expect(effectsOutput.create).not.toHaveBeenCalled();
    expect(effectsOutput.replace).not.toHaveBeenCalled();
  });

  it('refreshes only effects after proving the linked fixture unchanged', async () => {
    const linkedOutput = await output('linked.json', 'linked');
    const effectsOutput = await output('effects.json', 'old-effects');
    await persistSupabaseHistoryFixtures({
      effectsBody: 'new-effects',
      effectsOutput,
      linkedBody: 'linked',
      linkedOutput,
      mode: 'refresh-effects',
    });
    expect(linkedOutput.replace).not.toHaveBeenCalled();
    expect(effectsOutput.replace).toHaveBeenCalledWith('new-effects', {
      mode: 0o600,
    });
  });

  it('fails a refresh before writing when the linked fixture drifts', async () => {
    const linkedOutput = await output('linked.json', 'changed');
    const effectsOutput = await output('effects.json', 'old-effects');
    await expect(
      persistSupabaseHistoryFixtures({
        effectsBody: 'new-effects',
        effectsOutput,
        linkedBody: 'linked',
        linkedOutput,
        mode: 'refresh-effects',
      })
    ).rejects.toThrow('Captured replay fixture drift');
    expect(effectsOutput.read).not.toHaveBeenCalled();
    expect(effectsOutput.replace).not.toHaveBeenCalled();
  });

  it('restores both prior fixtures when the effects replacement fails', async () => {
    const linkedOutput = await output('linked.json', 'old-linked');
    const effectsOutput = await output('effects.json', 'old-effects');
    const replaceFailure = new Error('effects replacement failed');
    effectsOutput.replace.mockRejectedValueOnce(replaceFailure);

    await expect(
      persistSupabaseHistoryFixtures({
        effectsBody: 'new-effects',
        effectsOutput,
        linkedBody: 'new-linked',
        linkedOutput,
        mode: 'refresh-post-deploy',
      })
    ).rejects.toBe(replaceFailure);
    expect(effectsOutput.replace).toHaveBeenNthCalledWith(2, 'old-effects', {
      mode: 0o600,
    });
    expect(linkedOutput.replace).toHaveBeenNthCalledWith(2, 'old-linked', {
      mode: 0o600,
    });
  });

  it('aggregates replacement and every dual-restore failure', async () => {
    const linkedOutput = await output('linked.json', 'old-linked');
    const effectsOutput = await output('effects.json', 'old-effects');
    const replaceFailure = new Error('effects replacement failed');
    const effectsRollbackFailure = new Error('effects rollback failed');
    const linkedRollbackFailure = new Error('linked rollback failed');
    effectsOutput.replace
      .mockRejectedValueOnce(replaceFailure)
      .mockRejectedValueOnce(effectsRollbackFailure);
    linkedOutput.replace
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(linkedRollbackFailure);

    await expect(
      persistSupabaseHistoryFixtures({
        effectsBody: 'new-effects',
        effectsOutput,
        linkedBody: 'new-linked',
        linkedOutput,
        mode: 'refresh-post-deploy',
      })
    ).rejects.toMatchObject({
      errors: [replaceFailure, effectsRollbackFailure, linkedRollbackFailure],
      message: 'Captured replay fixture rollback failed',
    });
    expect(effectsOutput.replace).toHaveBeenCalledTimes(2);
    expect(linkedOutput.replace).toHaveBeenCalledTimes(2);
  });
});
