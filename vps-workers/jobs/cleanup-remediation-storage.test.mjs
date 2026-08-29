import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  cleanupRemediationStorage,
  runRemediationStorageCleanup,
} from './cleanup-remediation-storage.mjs';

describe('remediation storage cleanup', () => {
  it('rotates worker logs before they grow without bound', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-storage-'));
    writeFileSync(join(directory, 'worker.log'), 'new'.repeat(20));
    writeFileSync(join(directory, 'worker.log.1'), 'older');
    writeFileSync(join(directory, 'worker.log.2'), 'oldest');

    const result = cleanupRemediationStorage({
      logsDir: directory,
      maxLogBytes: 8,
      maxRotatedLogs: 2,
      registeredWorktrees: new Set(),
    });

    assert.equal(result.rotatedLogs, 1);
    assert.equal(
      readFileSync(join(directory, 'worker.log.1'), 'utf8'),
      'new'.repeat(20)
    );
    assert.equal(
      readFileSync(join(directory, 'worker.log.2'), 'utf8'),
      'older'
    );
    assert.equal(statSync(join(directory, 'worker.log.2')).isFile(), true);
  });

  it('removes only old orphaned pnpm stores outside registered worktrees', () => {
    const root = mkdtempSync(join(tmpdir(), 'baci-worktrees-'));
    const worktreeRoot = join(root, 'worktrees');
    mkdirSync(worktreeRoot);
    const orphanStore = join(worktreeRoot, 'old-run-pnpm-store');
    const retainedStore = join(worktreeRoot, 'retained-run-pnpm-store');
    mkdirSync(orphanStore);
    mkdirSync(retainedStore);
    const oldTime = Date.now() - 48 * 60 * 60 * 1_000;
    utimesSync(orphanStore, oldTime / 1_000, oldTime / 1_000);
    utimesSync(retainedStore, oldTime / 1_000, oldTime / 1_000);

    const result = cleanupRemediationStorage({
      now: Date.now(),
      orphanStoreRetentionMs: 24 * 60 * 60 * 1_000,
      registeredWorktrees: new Set([join(worktreeRoot, 'retained-run')]),
      worktreeRoot,
    });

    assert.equal(result.orphanedStores, 1);
    assert.equal(statSync(retainedStore).isDirectory(), true);
    assert.throws(() => statSync(orphanStore));
  });

  it('prunes excess drain quarantine artifacts but keeps recent evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-drain-artifacts-'));
    const oldArtifact = join(directory, 'vercel-drain.quarantine-old.jsonl');
    const newArtifact = join(directory, 'vercel-drain.quarantine-new.jsonl');
    const staleRotation = join(directory, 'vercel-drain.jsonl.3.gz');
    writeFileSync(oldArtifact, 'old');
    writeFileSync(newArtifact, 'new');
    writeFileSync(staleRotation, 'stale');
    const now = Date.now();
    utimesSync(oldArtifact, (now - 10_000) / 1_000, (now - 10_000) / 1_000);
    utimesSync(newArtifact, now / 1_000, now / 1_000);
    utimesSync(staleRotation, (now - 20_000) / 1_000, (now - 20_000) / 1_000);

    const result = cleanupRemediationStorage({
      logsDir: directory,
      maxRotatedLogs: 1,
      registeredWorktrees: new Set(),
    });

    assert.equal(result.prunedDrainArtifacts, 2);
    assert.equal(statSync(newArtifact).isFile(), true);
    assert.throws(() => statSync(oldArtifact));
    assert.throws(() => statSync(staleRotation));
  });

  it('keeps drain rotation retention independent from worker-log retention', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-drain-retention-'));
    writeFileSync(join(directory, 'worker.log'), 'new'.repeat(20));
    writeFileSync(join(directory, 'worker.log.1'), 'older');
    writeFileSync(join(directory, 'vercel-drain.jsonl'), 'drain-new'.repeat(4));
    writeFileSync(join(directory, 'vercel-drain.jsonl.1'), 'drain-old');
    writeFileSync(join(directory, 'vercel-drain.jsonl.2'), 'drain-oldest');

    cleanupRemediationStorage({
      logsDir: directory,
      maxDrainLogBytes: 8,
      maxDrainRotatedLogs: 2,
      maxLogBytes: 8,
      maxRotatedLogs: 1,
      registeredWorktrees: new Set(),
    });

    assert.equal(
      readFileSync(join(directory, 'worker.log.1'), 'utf8'),
      'new'.repeat(20)
    );
    assert.throws(() => statSync(join(directory, 'worker.log.2')));
    assert.equal(
      readFileSync(join(directory, 'vercel-drain.jsonl.2'), 'utf8'),
      'drain-old'
    );
  });

  it('rotates and prunes drain artifacts in the drain directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'baci-split-storage-'));
    const workerDirectory = join(root, 'worker-logs');
    const drainDirectory = join(root, 'drain');
    mkdirSync(workerDirectory);
    mkdirSync(drainDirectory);
    const drainPath = join(drainDirectory, 'vercel-drain.jsonl');
    writeFileSync(join(workerDirectory, 'worker.log'), 'worker-new');
    const oldArtifact = join(
      drainDirectory,
      'vercel-drain.quarantine-old.jsonl'
    );
    const newArtifact = join(
      drainDirectory,
      'vercel-drain.quarantine-new.jsonl'
    );
    const retainedArtifact = join(
      drainDirectory,
      'vercel-drain.quarantine-retained.jsonl'
    );
    const workerArtifact = join(
      workerDirectory,
      'vercel-drain.quarantine-worker.jsonl'
    );
    writeFileSync(oldArtifact, 'old');
    writeFileSync(newArtifact, 'new');
    writeFileSync(retainedArtifact, 'stale');
    writeFileSync(workerArtifact, 'worker');
    const now = Date.now();
    utimesSync(oldArtifact, (now - 30_000) / 1_000, (now - 30_000) / 1_000);
    utimesSync(newArtifact, (now + 20_000) / 1_000, (now + 20_000) / 1_000);
    utimesSync(
      retainedArtifact,
      (now + 10_000) / 1_000,
      (now + 10_000) / 1_000
    );
    writeFileSync(drainPath, 'drain-new');
    writeFileSync(`${drainPath}.1`, 'drain-old');

    const result = runRemediationStorageCleanup({
      env: {
        BACI_WORKER_LOG_DIR: workerDirectory,
        BACI_WORKER_LOG_MAX_BYTES: '4',
        BACI_WORKER_LOG_MAX_ROTATED_FILES: '1',
        VERCEL_ERROR_LOG_MAX_BYTES: '4',
        VERCEL_ERROR_LOG_MAX_ROTATED_FILES: '4',
        VERCEL_ERROR_LOG_PATH: drainPath,
      },
      logger: { log: () => undefined },
    });

    assert.equal(result.rotatedLogs, 2);
    assert.equal(result.prunedDrainArtifacts, 1);
    assert.equal(readFileSync(`${drainPath}.1`, 'utf8'), 'drain-new');
    assert.equal(readFileSync(`${drainPath}.2`, 'utf8'), 'drain-old');
    assert.equal(readFileSync(drainPath, 'utf8'), '');
    assert.equal(
      readFileSync(join(workerDirectory, 'worker.log.1'), 'utf8'),
      'worker-new'
    );
    assert.throws(() => statSync(oldArtifact));
    assert.equal(statSync(newArtifact).isFile(), true);
    assert.equal(statSync(retainedArtifact).isFile(), true);
    assert.equal(statSync(workerArtifact).isFile(), true);
  });

  it('uses the autofix worktree root default when no override is configured', () => {
    const root = mkdtempSync(join(tmpdir(), 'baci-default-worktree-root-'));
    const repoDir = join(root, 'repo');
    const worktreeRoot = join(root, 'baci-remediation-worktrees');
    const orphanStore = join(worktreeRoot, 'orphan-run-pnpm-store');
    mkdirSync(repoDir);
    mkdirSync(orphanStore, { recursive: true });
    const oldTime = Date.now() - 48 * 60 * 60 * 1_000;
    utimesSync(orphanStore, oldTime / 1_000, oldTime / 1_000);

    runRemediationStorageCleanup({
      env: { BACI_REPO_DIR: repoDir },
      logger: { log: () => undefined },
      runner: () => ({
        error: null,
        status: 0,
        stderr: '',
        stdout: `worktree ${repoDir}\n`,
      }),
    });

    assert.throws(() => statSync(orphanStore));
  });
});
