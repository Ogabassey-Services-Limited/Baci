import { findRetainedRemediationWorktree } from './remediation-retained-worktree.mjs';

export function cleanupRemediationWorktree({
  branch,
  childEnv,
  repoDir,
  runner,
  worktreeDir,
}) {
  const resolvedWorktreeDir =
    worktreeDir ||
    (branch
      ? findRetainedRemediationWorktree({
          branch,
          childEnv,
          repoDir,
          runner,
        })
      : '');
  if (!resolvedWorktreeDir) return '';

  runner('git', ['worktree', 'remove', '--force', resolvedWorktreeDir], {
    cwd: repoDir,
    env: childEnv,
    shell: false,
  });
  return resolvedWorktreeDir;
}
