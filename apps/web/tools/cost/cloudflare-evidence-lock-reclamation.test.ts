import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reclaimLockIfOwner } from './cloudflare-evidence-lock-reclamation';

describe('cloudflare evidence lock reclamation', () => {
  it('does not delete a successor created after stale-owner content check', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, '.active-run.lock');
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
    await writeFile(lockPath, staleRecord, { mode: 0o600 });

    await reclaimLockIfOwner(lockPath, staleRecord, async () => {
      await writeFile(lockPath, successorRecord, { mode: 0o600 });
    });

    await expect(readFile(lockPath, 'utf8')).resolves.toBe(successorRecord);
    await rm(lockPath, { force: true });
  });
});
