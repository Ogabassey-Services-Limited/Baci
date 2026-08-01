import { execFile } from 'node:child_process';
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';
import { verifySupabaseHistoryReplayManifest } from './verify-supabase-history-replay-manifest';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../..');
const temporaryRoots: string[] = [];
const execFileAsync = promisify(execFile);

async function copyWorkspace(prefix = 'baci-replay-verifier-') {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
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

describe('verifySupabaseHistoryReplayManifest', () => {
  it('verifies the frozen base without Docker, Supabase, or network I/O', async () => {
    const result = await verifySupabaseHistoryReplayManifest(WORKSPACE_ROOT, {
      pendingRepairState: 'materialized',
    });
    expect(result.pendingRepairState).toBe('materialized');
    expect(result.bootstrapSources).toHaveLength(125);
    expect(result.verifiedSources).toHaveLength(424);
    expect(result.postReplaySources).toHaveLength(12);
    expect(result.manifest.pendingSources).toHaveLength(76);
    expect(result.productionEffectProvenance.exceptionalRecords).toHaveLength(
      31
    );
  }, 60_000);

  it('requires the explicit pending repair state at runtime', async () => {
    const invalidOptions = {};
    const verification = verifySupabaseHistoryReplayManifest(
      WORKSPACE_ROOT,
      // @ts-expect-error The public type requires the discriminant; runtime still fails closed.
      invalidOptions
    );
    await expect(verification).rejects.toThrow(
      'pendingRepairState must be explicit'
    );
  });

  it('rejects a present repair in not-materialized mode', async () => {
    const root = await copyWorkspace();
    await writeFile(
      path.join(
        root,
        'supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql'
      ),
      'unexpected bytes\n'
    );
    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'not-materialized',
      })
    ).rejects.toThrow('must be absent');
  });

  it('requires exact repair bytes in materialized mode', async () => {
    const root = await copyWorkspace();
    const repairPath = path.join(
      root,
      'supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql'
    );
    await writeFile(repairPath, 'unexpected bytes\n');
    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow('repair SHA-256');
  });

  it('rejects materialized mode when the repair is absent', async () => {
    const root = await copyWorkspace();
    await rm(path.join(root, supabaseHistoryReplayManifest.repair.path));

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow('must exist');
  });

  it('accepts materialized mode only with the exact repair body', async () => {
    const root = await copyWorkspace();
    await writeFile(
      path.join(root, supabaseHistoryReplayManifest.repair.path),
      supabaseHistoryReplayManifest.repair.body
    );

    const result = await verifySupabaseHistoryReplayManifest(root, {
      pendingRepairState: 'materialized',
    });

    expect(result.pendingRepairState).toBe('materialized');
    expect(result.verifiedSources).toHaveLength(424);
  }, 30_000);

  it('requires every ordered forward repair to exist', async () => {
    const root = await copyWorkspace();
    await rm(
      path.join(root, supabaseHistoryReplayManifest.forwardRepairs[0].path)
    );

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow('Forward repair must exist');
  }, 30_000);

  it('requires exact forward-repair bytes', async () => {
    const root = await copyWorkspace();
    await writeFile(
      path.join(root, supabaseHistoryReplayManifest.forwardRepairs[1].path),
      'unexpected bytes\n'
    );

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow('Forward repair SHA-256');
  }, 30_000);

  it('requires exact post-replay source bytes', async () => {
    const root = await copyWorkspace();
    await writeFile(
      path.join(
        root,
        supabaseHistoryReplayManifest.postReplaySources[1].repositoryPath
      ),
      'unexpected bytes\n'
    );

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow(/post-replay.*SHA-256/i);
  }, 30_000);

  it('rejects current-tree migration drift from the frozen base', async () => {
    const root = await copyWorkspace();
    const source = path.join(
      root,
      'supabase/migrations/20260712150001_domain_event_pipeline_tables.sql'
    );
    await writeFile(source, `${await readFile(source, 'utf8')}\n-- drift\n`);
    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow(/current-tree source drift/i);
  }, 30_000);

  it('rejects an extra SQL symlink in the migration registry', async () => {
    const root = await copyWorkspace();
    await symlink(
      '20260712150001_domain_event_pipeline_tables.sql',
      path.join(root, 'supabase/migrations/20990101000000_extra.sql')
    );

    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow(/migration registry differs/i);
  }, 30_000);

  it('rejects canonical provenance drift', async () => {
    const root = await copyWorkspace();
    const fixture = path.join(
      root,
      'apps/web/tools/db/fixtures/production-effect-provenance.json'
    );
    await writeFile(
      fixture,
      (await readFile(fixture, 'utf8')).replace(
        'partial-order-effect-replay',
        'drift'
      )
    );
    await expect(
      verifySupabaseHistoryReplayManifest(root, {
        pendingRepairState: 'materialized',
      })
    ).rejects.toThrow(/provenance|canonical/i);
  });

  it('ignores replacement refs when enumerating the frozen base', async () => {
    const root = await copyWorkspace();
    const emptyTreeFixture = path.join(root, 'empty-tree');
    await writeFile(emptyTreeFixture, '');
    const { stdout: emptyTree } = await execFileAsync('git', [
      '-C',
      root,
      'hash-object',
      '-t',
      'tree',
      '-w',
      emptyTreeFixture,
    ]);
    const { stdout: replacementCommit } = await execFileAsync('git', [
      '-C',
      root,
      '-c',
      'user.name=Baci Test',
      '-c',
      'user.email=test@usebaci.com',
      'commit-tree',
      emptyTree.trim(),
      '-m',
      'replacement',
    ]);
    await execFileAsync('git', [
      '-C',
      root,
      'replace',
      supabaseHistoryReplayManifest.baseSha,
      replacementCommit.trim(),
    ]);

    const result = await verifySupabaseHistoryReplayManifest(root, {
      pendingRepairState: 'materialized',
    });

    expect(result.verifiedSources).toHaveLength(424);
  }, 30_000);

  it('uses argv-safe git calls for workspace paths containing shell metacharacters', async () => {
    const root = await copyWorkspace('baci-replay;touch SHOULD_NOT_EXIST;');
    const result = await verifySupabaseHistoryReplayManifest(root, {
      pendingRepairState: 'materialized',
    });
    expect(result.verifiedSources).toHaveLength(424);
    await expect(
      readFile(path.join(root, 'SHOULD_NOT_EXIST'))
    ).rejects.toThrow();
  }, 30_000);
});
