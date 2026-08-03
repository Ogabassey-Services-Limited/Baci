import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { withEvidenceLockPathGuard } from './cloudflare-evidence-lock-guard';

const workspaceLockPath = (workspaceRoot: string) => {
  const workspaceDigest = createHash('sha256')
    .update(resolve(workspaceRoot))
    .digest('hex');
  return join(
    tmpdir(),
    `.baci-cloudflare-evidence-workspace-${workspaceDigest}.lock`
  );
};

/** Holds a test-only cross-worker lock while a test transiently mutates a workspace. */
export async function holdCloudflareEvidenceWorkspaceTestLock(
  workspaceRoot: string
): Promise<() => Promise<void>> {
  let releaseHold!: () => void;
  let resolveEntered!: () => void;
  let rejectEntered!: (error: unknown) => void;
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve;
  });
  const entered = new Promise<void>((resolve, reject) => {
    resolveEntered = resolve;
    rejectEntered = reject;
  });
  const operation = withEvidenceLockPathGuard(
    workspaceLockPath(workspaceRoot),
    async () => {
      resolveEntered();
      await hold;
    }
  );
  void operation.catch(rejectEntered);
  await entered;
  return async () => {
    releaseHold();
    await operation;
  };
}
