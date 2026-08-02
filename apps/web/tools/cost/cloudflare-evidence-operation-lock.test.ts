import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withEvidenceRunOperationLock } from './cloudflare-evidence-operation-lock';

describe('cloudflare evidence operation lock', () => {
  it('serializes complete provider operations for one run', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-operation-'));
    await chmod(stateDir, 0o700);
    const runId = '0123456789abcdef0123456789abcdef';
    const order: string[] = [];
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withEvidenceRunOperationLock(stateDir, runId, async () => {
      order.push('first-start');
      markFirstStarted();
      await firstHeld;
      order.push('first-end');
    });
    const second = withEvidenceRunOperationLock(stateDir, runId, async () => {
      order.push('second');
    });
    await firstStarted;
    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});
