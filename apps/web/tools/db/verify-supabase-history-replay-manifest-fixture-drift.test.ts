import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySupabaseHistoryReplayManifest } from './verify-supabase-history-replay-manifest';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../..');
const temporaryRoots: string[] = [];
const execFileAsync = promisify(execFile);

async function copyWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-replay-drift-'));
  temporaryRoots.push(root);
  await execFileAsync('git', [
    'clone',
    '--shared',
    '--no-checkout',
    WORKSPACE_ROOT,
    root,
  ]);
  await cp(
    path.join(WORKSPACE_ROOT, 'supabase/migrations'),
    path.join(root, 'supabase/migrations'),
    { recursive: true }
  );
  await cp(
    path.join(WORKSPACE_ROOT, 'supabase/tests/migration_history_overlays'),
    path.join(root, 'supabase/tests/migration_history_overlays'),
    { recursive: true }
  );
  await cp(
    path.join(WORKSPACE_ROOT, 'apps/web/tools/db/fixtures'),
    path.join(root, 'apps/web/tools/db/fixtures'),
    { recursive: true }
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('post-deploy replay fixture drift', () => {
  it('rejects refreshed production-effect fixture byte drift', async () => {
    const root = await copyWorkspace();
    const fixture = path.join(
      root,
      'apps/web/tools/db/fixtures/production-history-effects.json'
    );
    await writeFile(
      fixture,
      (await readFile(fixture, 'utf8')).replace(
        '71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253',
        '0'.repeat(64)
      )
    );

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow(/production-effect fixture/i);
  });

  it('rejects refreshed linked-ledger fixture byte drift', async () => {
    const root = await copyWorkspace();
    const fixture = path.join(
      root,
      'apps/web/tools/db/fixtures/linked-migration-ledger.json'
    );
    await writeFile(
      fixture,
      (await readFile(fixture, 'utf8')).replace(
        '20260714225503',
        '20260714225504'
      )
    );

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow(/linked-ledger fixture/i);
  });
});
