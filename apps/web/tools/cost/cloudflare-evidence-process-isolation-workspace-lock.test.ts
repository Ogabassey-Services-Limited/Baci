import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { holdCloudflareEvidenceWorkspaceTestLock } from './cloudflare-evidence-process-isolation-workspace-lock.test-support';

describe('holdCloudflareEvidenceWorkspaceTestLock', () => {
  it('serializes concurrent operations for the same workspace', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'baci-evidence-workspace-lock-')
    );
    const releaseFirst =
      await holdCloudflareEvidenceWorkspaceTestLock(workspaceRoot);
    let secondEntered = false;
    const second = holdCloudflareEvidenceWorkspaceTestLock(workspaceRoot).then(
      (release) => {
        secondEntered = true;
        return release;
      }
    );

    await Promise.resolve();
    expect(secondEntered).toBe(false);

    await releaseFirst();
    const releaseSecond = await second;
    expect(secondEntered).toBe(true);
    await releaseSecond();
    await rm(workspaceRoot, { recursive: true, force: true });
  });
});
