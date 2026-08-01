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

  it('restores a successor atomically replacing the pathname before rename', async () => {
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

  it('does not remove a successor created after rename detached the owner', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
    await writeFile(lockPath, staleRecord, { mode: 0o600 });

    await expect(
      reclaimLockIfOwner(lockPath, staleRecord, async () => {
        await writeFile(lockPath, successorRecord, { mode: 0o600 });
      })
    ).resolves.toBe(true);
    await expect(readFile(lockPath, 'utf8')).resolves.toBe(successorRecord);
    await rm(stateDir, { recursive: true, force: true });
  });

  it('leaves a newer successor when restoring a detached successor sees EEXIST', async () => {
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
});
