export function cleanupRemediationWorktree({
  childEnv,
  repoDir,
  runner,
  worktreeDir,
}) {
  if (!worktreeDir) return;

  runner('git', ['worktree', 'remove', '--force', worktreeDir], {
    cwd: repoDir,
    env: childEnv,
    shell: false,
  });
}
