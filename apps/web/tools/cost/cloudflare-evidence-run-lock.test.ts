import { chmod, mkdtemp, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  acquireActiveRunLock,
  releaseActiveRunLock,
  withEvidenceRunTransitionLock,
} from './cloudflare-evidence-run-lock';

describe('cloudflare evidence run lock', () => {
  const runA = '0123456789abcdef0123456789abcdef';
  const runB = 'abcdef0123456789abcdef0123456789';

  it('rejects a second owner while the first journal is not terminal', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const options = {
      readJournal: async () => ({ phase: 'prepared' }),
      isTerminal: (phase: string) => phase === 'closed_stop',
    };
    await acquireActiveRunLock(stateDir, runA, options);
    await expect(acquireActiveRunLock(stateDir, runB, options)).rejects.toThrow(
      'active'
    );
    await releaseActiveRunLock(stateDir, runA);
  });

  it('reclaims a lock whose journal is already terminal', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    await acquireActiveRunLock(stateDir, runA, {
      readJournal: async () => ({ phase: 'closed_stop' }),
      isTerminal: (phase: string) => phase === 'closed_stop',
    });
    await acquireActiveRunLock(stateDir, runB, {
      readJournal: async () => ({ phase: 'closed_stop' }),
      isTerminal: (phase: string) => phase === 'closed_stop',
    });
    await releaseActiveRunLock(stateDir, runB);
  });

  it('reclaims an orphaned preparation lock only after its owner is dead', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    await writeFile(
      join(stateDir, '.active-run.lock'),
      JSON.stringify({ runId: runA, pid: -1, token: 'orphan' }),
      { mode: 0o600 }
    );
    await expect(
      acquireActiveRunLock(stateDir, runB, {
        readJournal: async () => {
          throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        },
        isTerminal: () => false,
      })
    ).resolves.toBeUndefined();
    await releaseActiveRunLock(stateDir, runB);
  });

  it('does not reclaim a missing-journal lock while its owner is alive', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    await writeFile(
      join(stateDir, '.active-run.lock'),
      JSON.stringify({ runId: runA, pid: process.pid, token: 'live' }),
      { mode: 0o600 }
    );
    await expect(
      acquireActiveRunLock(stateDir, runB, {
        readJournal: async () => {
          throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        },
        isTerminal: () => false,
      })
    ).rejects.toThrow('active');
  });

  it('serializes concurrent read-modify-write transitions for one run', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const order: string[] = [];
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withEvidenceRunTransitionLock(stateDir, runA, async () => {
      order.push('first-start');
      markFirstStarted();
      await firstHeld;
      order.push('first-end');
    });
    const second = withEvidenceRunTransitionLock(stateDir, runA, async () => {
      order.push('second');
    });
    await firstStarted;
    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });

  it('reclaims a crashed transition lock that never wrote its owner record', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const lockPath = join(stateDir, `.journal-${runA}.lock`);
    await writeFile(lockPath, '', { mode: 0o600 });
    const stale = new Date(Date.now() - 6_000);
    await utimes(lockPath, stale, stale);
    await expect(
      withEvidenceRunTransitionLock(stateDir, runA, async () => 'recovered')
    ).resolves.toBe('recovered');
  });

  it('reclaims a live PID when its recorded process start identity differs', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    await writeFile(
      join(stateDir, `.journal-${runA}.lock`),
      JSON.stringify({
        runId: runA,
        pid: process.pid,
        token: 'reused-pid',
        processStartTime: 'previous-process-start',
      }),
      { mode: 0o600 }
    );
    await expect(
      withEvidenceRunTransitionLock(stateDir, runA, async () => 'recovered')
    ).resolves.toBe('recovered');
  });

  it('times out when a live transition owner never releases its lock', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    await writeFile(
      join(stateDir, `.journal-${runA}.lock`),
      JSON.stringify({ runId: runA, pid: process.pid, token: 'live' }),
      { mode: 0o600 }
    );
    const realNow = Date.now;
    const startedAt = realNow();
    let nowReads = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      nowReads += 1;
      return startedAt + (nowReads >= 3 ? 60_001 : 0);
    });
    try {
      const waiting = withEvidenceRunTransitionLock(
        stateDir,
        runA,
        async () => 'unreachable'
      );
      await expect(waiting).rejects.toThrow(
        'journal transition lock wait timed out'
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not follow a symlinked active lock', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const target = join(stateDir, 'outside.lock');
    await writeFile(target, JSON.stringify({ runId: runA, pid: process.pid }), {
      mode: 0o600,
    });
    await symlink(target, join(stateDir, '.active-run.lock'));
    await expect(
      acquireActiveRunLock(stateDir, runB, {
        readJournal: async () => ({ phase: 'prepared' }),
        isTerminal: () => false,
      })
    ).rejects.toThrow('private regular');
  });

  it('releases a queued successor when the previous transition rejects', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const first = withEvidenceRunTransitionLock(stateDir, runA, async () => {
      throw new Error('transition failed');
    });
    const second = withEvidenceRunTransitionLock(
      stateDir,
      runA,
      async () => 'recovered'
    );
    await expect(first).rejects.toThrow('transition failed');
    await expect(second).resolves.toBe('recovered');
  });
});
