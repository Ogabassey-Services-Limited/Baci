import {
  formatBoundedSubprocessOutput,
  redactCodexError,
} from './remediation-codex-output.mjs';

export function hasRetainedRemediationWorktree({
  branch,
  childEnv,
  repoDir,
  runner,
  worktreeDir,
}) {
  const result = runner('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoDir,
    env: childEnv,
    shell: false,
  });
  if (result.error) throw redactCodexError(result.error);
  if (result.status !== 0) {
    throw new Error(
      `git worktree list --porcelain failed: ${formatBoundedSubprocessOutput(result)}`
    );
  }

  const expectedBranch = `branch refs/heads/${branch}`;
  return (result.stdout || '').split(/\r?\n\r?\n/).some((record) => {
    const lines = record.split(/\r?\n/);
    return (
      lines.includes(`worktree ${worktreeDir}`) &&
      lines.includes(expectedBranch)
    );
  });
}
