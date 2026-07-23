import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyCurrentMigrationRegistry } from './verify-current-migration-registry';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'migration-registry-'));
  roots.push(root);
  await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
  await writeFile(
    path.join(root, 'supabase/migrations/20260101000000_a.sql'),
    ''
  );
  return root;
}

describe('verifyCurrentMigrationRegistry', () => {
  it('accepts the exact expected SQL registry', async () => {
    const root = await workspace();
    await expect(
      verifyCurrentMigrationRegistry(root, [
        'supabase/migrations/20260101000000_a.sql',
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects unexpected migration files', async () => {
    const root = await workspace();
    await expect(verifyCurrentMigrationRegistry(root, [])).rejects.toThrow(
      'Current top-level migration registry differs'
    );
  });
});
