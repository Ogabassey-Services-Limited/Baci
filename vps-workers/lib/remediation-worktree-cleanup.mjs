import { findRetainedRemediationWorktree } from './remediation-retained-worktree.mjs';
import { runRemediationChecked } from './remediation-subprocess.mjs';

function registeredExplicitWorktree({
  childEnv,
  repoDir,
  runner,
  worktreeDir,
}) {
  const records = runRemediationChecked(
    'git',
    ['worktree', 'list', '--porcelain'],
    { cwd: repoDir, env: childEnv, runner }
  );
  return records
    .split(/\r?\n\r?\n/)
    .some((record) => record.split(/\r?\n/).includes(`worktree ${worktreeDir}`))
    ? worktreeDir
    : '';
}

export function cleanupRemediationWorktree({
  branch,
  childEnv,
  repoDir,
  runner,
  worktreeDir,
}) {
  const resolvedWorktreeDir = worktreeDir
    ? registeredExplicitWorktree({ childEnv, repoDir, runner, worktreeDir })
    : branch
      ? findRetainedRemediationWorktree({
          branch,
          childEnv,
          repoDir,
          runner,
        })
      : '';
  if (!resolvedWorktreeDir) return '';

  runRemediationChecked(
    'git',
    ['worktree', 'remove', '--force', resolvedWorktreeDir],
    { cwd: repoDir, env: childEnv, runner }
  );
  runRemediationChecked('git', ['worktree', 'prune'], {
    cwd: repoDir,
    env: childEnv,
    runner,
  });
  return resolvedWorktreeDir;
}
