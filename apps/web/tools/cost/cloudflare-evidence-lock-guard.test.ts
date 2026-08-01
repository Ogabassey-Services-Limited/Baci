import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  tryCreateEvidenceLock,
  withEvidenceLockPathGuard,
} from './cloudflare-evidence-lock-guard';

describe('cloudflare evidence lock guard', () => {
  it('serializes acquisition with reclamation path mutations', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-guard-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    let firstEntered!: () => void;
    let releaseFirst!: () => void;
    const firstEnteredPromise = new Promise<void>((resolve) => {
      firstEntered = resolve;
    });
    const firstReleasePromise = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let secondEntered = false;
    const first = withEvidenceLockPathGuard(lockPath, async () => {
      firstEntered();
      await firstReleasePromise;
    });
    await firstEnteredPromise;
    const second = withEvidenceLockPathGuard(lockPath, async () => {
      secondEntered = true;
    });
    await Promise.resolve();
    expect(secondEntered).toBe(false);
    releaseFirst();
    await Promise.all([first, second]);
    expect(secondEntered).toBe(true);
    await expect(tryCreateEvidenceLock(lockPath, 'record\n')).resolves.toBe(
      true
    );
    await rm(stateDir, { recursive: true, force: true });
  });

  it('reclaims a crash-left guard bound to a dead owner', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-guard-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    const guardPath = `${lockPath}.reclaim-guard`;
    await mkdir(guardPath, { mode: 0o700 });
    await writeFile(
      `${stateDir}/.active-run.lock.reclaim-owner-0-dead`,
      '{"pid":999999,"processStartTime":"dead","token":"dead"}\n',
      { mode: 0o600 }
    );
    await writeFile(
      `${guardPath}/owner`,
      '{"pid":999999,"processStartTime":"dead","token":"dead"}\n',
      { mode: 0o600 }
    );

    let entered = false;
    await expect(
      withEvidenceLockPathGuard(lockPath, async () => {
        entered = true;
      })
    ).resolves.toBeUndefined();

    expect(entered).toBe(true);
    await expect(readdir(stateDir)).resolves.toEqual([]);
    await rm(stateDir, { recursive: true, force: true });
  });

  it('records the owning process inside the guard while the operation runs', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-guard-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    let ownerRecord = '';
    await withEvidenceLockPathGuard(lockPath, async () => {
      ownerRecord = await readFile(`${lockPath}.reclaim-guard/owner`, 'utf8');
      expect(JSON.parse(ownerRecord)).toMatchObject({
        pid: process.pid,
        token: expect.any(String),
      });
    });
    expect(ownerRecord).toContain('processStartTime');
    await rm(stateDir, { recursive: true, force: true });
  });

  it('tolerates owner metadata disappearing during concurrent acquisition', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-guard-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');

    for (let round = 0; round < 2; round++) {
      const acquisitions = Array.from({ length: 4 }, () =>
        withEvidenceLockPathGuard(lockPath, async () => {
          await new Promise<void>((resolve) => setImmediate(resolve));
        })
      );
      await expect(Promise.all(acquisitions)).resolves.toHaveLength(4);
    }

    await expect(readdir(stateDir)).resolves.toEqual([]);
    await rm(stateDir, { recursive: true, force: true });
  });
});
