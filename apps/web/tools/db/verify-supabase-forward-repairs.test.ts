import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ForwardReplayRepair } from './supabase-history-replay-types';
import { verifySupabaseForwardRepairs } from './verify-supabase-forward-repairs';

const temporaryRoots: string[] = [];
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

async function fixture() {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), 'baci-forward-repairs-')
  );
  temporaryRoots.push(temporaryRoot);
  const root = await realpath(temporaryRoot);
  await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
  const bodies = ['select 1;\n', 'select 2;\n'] as const;
  const repairs: ForwardReplayRepair[] = bodies.map((body, index) => ({
    changedComponent: {
      category: 'function',
      identity: `public.repair_${index + 1}()`,
    },
    path: `supabase/migrations/2026071422550${index + 2}_repair.sql`,
    reason: `repair_${index + 1}`,
    sha256: sha256(body),
  }));
  await Promise.all(
    repairs.map((repair, index) =>
      writeFile(path.join(root, repair.path), bodies[index] as string)
    )
  );
  return { repairs, root };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('verifySupabaseForwardRepairs', () => {
  it('accepts exactly two distinct hash-bound forward repairs', async () => {
    const { repairs, root } = await fixture();

    await expect(
      verifySupabaseForwardRepairs(root, repairs)
    ).resolves.toBeUndefined();
  });

  it('rejects duplicate paths or changed-component identities', async () => {
    const pathDuplicate = await fixture();
    pathDuplicate.repairs[1].path = pathDuplicate.repairs[0].path;
    await expect(
      verifySupabaseForwardRepairs(pathDuplicate.root, pathDuplicate.repairs)
    ).rejects.toThrow('Forward repair manifest drift');

    const identityDuplicate = await fixture();
    identityDuplicate.repairs[1].changedComponent.identity =
      identityDuplicate.repairs[0].changedComponent.identity;
    await expect(
      verifySupabaseForwardRepairs(
        identityDuplicate.root,
        identityDuplicate.repairs
      )
    ).rejects.toThrow('Forward repair manifest drift');
  });

  it('rejects a missing forward repair', async () => {
    const { repairs, root } = await fixture();
    repairs[0].path = 'supabase/migrations/20260714225502_missing.sql';

    await expect(verifySupabaseForwardRepairs(root, repairs)).rejects.toThrow(
      'Forward repair must exist'
    );
  });

  it('rejects changed forward-repair bytes', async () => {
    const { repairs, root } = await fixture();
    await writeFile(path.join(root, repairs[1].path), 'changed\n');

    await expect(verifySupabaseForwardRepairs(root, repairs)).rejects.toThrow(
      'Forward repair SHA-256 mismatch'
    );
  });
});
