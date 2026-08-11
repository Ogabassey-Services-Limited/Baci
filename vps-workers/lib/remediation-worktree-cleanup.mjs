import { realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { findRetainedRemediationWorktree } from './remediation-retained-worktree.mjs';
import { runRemediationChecked } from './remediation-subprocess.mjs';

const canonicalWorktreePath = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

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
  const canonicalRequestedWorktree = canonicalWorktreePath(worktreeDir);
  for (const record of records.split(/\r?\n\r?\n/)) {
    const worktreeLine = record
      .split(/\r?\n/)
      .find((line) => line.startsWith('worktree '));
    if (!worktreeLine) continue;
    const registeredWorktree = worktreeLine.slice('worktree '.length);
    if (
      canonicalWorktreePath(registeredWorktree) === canonicalRequestedWorktree
    ) {
      return registeredWorktree;
    }
  }
  return '';
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
  const pnpmStorePath = join(
    dirname(resolvedWorktreeDir),
    `${basename(resolvedWorktreeDir)}-pnpm-store`
  );
  runRemediationChecked('rm', ['-rf', '--', pnpmStorePath], {
    cwd: repoDir,
    env: childEnv,
    runner,
  });
  return resolvedWorktreeDir;
}
