import { cleanupRemediationWorktree } from './remediation-worktree-cleanup.mjs';

export function cleanupRemediationAttempt(
  { childEnv, repoDir, runner, worktreeDir },
  cleanupCompletedWorktree,
  cleanupWorktreeOnCompletion,
  committedLocally,
  retainFailedWorktree
) {
  if (!cleanupWorktreeOnCompletion) return;
  cleanupRemediationWorktree({
    childEnv,
    removeWorktree:
      cleanupCompletedWorktree || !(committedLocally || retainFailedWorktree),
    repoDir,
    runner,
    worktreeDir,
  });
}
