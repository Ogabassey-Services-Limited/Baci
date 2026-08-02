import {
  chmod,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tryCreateEvidenceLock } from './cloudflare-evidence-lock-guard';
import { reclaimLockIfOwner } from './cloudflare-evidence-lock-reclamation';

describe('cloudflare evidence lock reclamation', () => {
  const staleRecord = JSON.stringify({
    runId: '0123456789abcdef0123456789abcdef',
    pid: -1,
    token: 'stale',
  });
  const successorRecord = JSON.stringify({
    runId: 'abcdef0123456789abcdef0123456789',
    pid: process.pid,
    token: 'successor',
  });

  it('reclaims the verified owner when no successor replaces the pathname', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    await writeFile(lockPath, staleRecord, { mode: 0o600 });

    await expect(reclaimLockIfOwner(lockPath, staleRecord)).resolves.toBe(true);
    await expect(readFile(lockPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await rm(stateDir, { recursive: true, force: true });
  });

  it('leaves a successor that replaced the pathname before the hard-link claim', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    const successorTempPath = join(stateDir, '.successor.lock');
    await writeFile(lockPath, staleRecord, { mode: 0o600 });
    await writeFile(successorTempPath, successorRecord, { mode: 0o600 });

    await expect(
      reclaimLockIfOwner(lockPath, staleRecord, undefined, async () => {
        await rename(successorTempPath, lockPath);
      })
    ).resolves.toBe(false);
    await expect(readFile(lockPath, 'utf8')).resolves.toBe(successorRecord);
    await rm(stateDir, { recursive: true, force: true });
  });

  it('does not remove a successor created after the hard-link claim', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    await writeFile(lockPath, staleRecord, { mode: 0o600 });

    await expect(
      reclaimLockIfOwner(lockPath, staleRecord, async () => {
        await writeFile(lockPath, successorRecord, { mode: 0o600 });
      })
    ).resolves.toBe(false);
    await expect(readFile(lockPath, 'utf8')).resolves.toBe(successorRecord);
    await rm(stateDir, { recursive: true, force: true });
  });

  it('leaves a newer successor when the pathname changes while reclaiming', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    const successorTempPath = join(stateDir, '.successor.lock');
    const newerSuccessorRecord = `${successorRecord}-newer`;
    await writeFile(lockPath, staleRecord, { mode: 0o600 });
    await writeFile(successorTempPath, successorRecord, { mode: 0o600 });

    await expect(
      reclaimLockIfOwner(
        lockPath,
        staleRecord,
        async () => {
          await writeFile(lockPath, newerSuccessorRecord, { mode: 0o600 });
        },
        async () => {
          await rename(successorTempPath, lockPath);
        }
      )
    ).resolves.toBe(false);
    await expect(readFile(lockPath, 'utf8')).resolves.toBe(
      newerSuccessorRecord
    );
    await rm(stateDir, { recursive: true, force: true });
  });

  it('revalidates immediately before unlinking a successor replacement', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    const successorPath = join(stateDir, '.successor.lock');
    await writeFile(lockPath, staleRecord, { mode: 0o600 });
    await writeFile(successorPath, successorRecord, { mode: 0o600 });

    await expect(
      reclaimLockIfOwner(
        lockPath,
        staleRecord,
        undefined,
        undefined,
        async () => {
          await rename(successorPath, lockPath);
        }
      )
    ).resolves.toBe(false);
    await expect(readFile(lockPath, 'utf8')).resolves.toBe(successorRecord);
    await rm(stateDir, { recursive: true, force: true });
  });

  it('keeps guarded contenders behind the reclamation unlink boundary', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    await writeFile(lockPath, staleRecord, { mode: 0o600 });
    let entered!: () => void;
    let release!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const reclaim = reclaimLockIfOwner(
      lockPath,
      staleRecord,
      undefined,
      undefined,
      async () => {
        entered();
        await releasePromise;
      }
    );
    await enteredPromise;
    let contenderSettled = false;
    const contender = tryCreateEvidenceLock(lockPath, successorRecord).then(
      (result) => {
        contenderSettled = true;
        return result;
      }
    );
    await Promise.resolve();
    expect(contenderSettled).toBe(false);
    release();
    await expect(Promise.all([reclaim, contender])).resolves.toEqual([
      true,
      true,
    ]);
    await expect(readFile(lockPath, 'utf8')).resolves.toBe(successorRecord);
    await rm(stateDir, { recursive: true, force: true });
  });
});
