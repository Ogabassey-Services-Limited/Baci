import { chmod, mkdtemp, rm } from 'node:fs/promises';
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
});
