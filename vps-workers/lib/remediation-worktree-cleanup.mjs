import { findRetainedRemediationWorktree } from './remediation-retained-worktree.mjs';
import { runRemediationChecked } from './remediation-subprocess.mjs';

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

  runRemediationChecked(
    'git',
    ['worktree', 'remove', '--force', resolvedWorktreeDir],
    { cwd: repoDir, env: childEnv, runner }
  );
  return resolvedWorktreeDir;
}
