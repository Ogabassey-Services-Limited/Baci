import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  acquireActiveRunLock,
  releaseActiveRunLock,
} from './cloudflare-evidence-run-lock';

describe('cloudflare evidence run lock', () => {
  it('rejects a second owner while the first journal is not terminal', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    const options = {
      readJournal: async () => ({ phase: 'prepared' }),
      isTerminal: (phase: string) => phase === 'closed_stop',
    };
    await acquireActiveRunLock(stateDir, 'run-a', options);
    await expect(
      acquireActiveRunLock(stateDir, 'run-b', options)
    ).rejects.toThrow('active');
    await releaseActiveRunLock(stateDir, 'run-a');
  });

  it('reclaims a lock whose journal is already terminal', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-lock-'));
    await chmod(stateDir, 0o700);
    await acquireActiveRunLock(stateDir, 'run-a', {
      readJournal: async () => ({ phase: 'closed_stop' }),
      isTerminal: (phase: string) => phase === 'closed_stop',
    });
    await acquireActiveRunLock(stateDir, 'run-b', {
      readJournal: async () => ({ phase: 'closed_stop' }),
      isTerminal: (phase: string) => phase === 'closed_stop',
    });
    await releaseActiveRunLock(stateDir, 'run-b');
  });
});
