import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanupRemediationWorktree } from './remediation-worktree-cleanup.mjs';

describe('remediation worktree cleanup', () => {
  it('force-removes a completed worktree with the child environment', () => {
    const calls = [];
    const childEnv = { PATH: '/safe/bin' };
    const runner = (command, args, options) => {
      calls.push({ args, command, options });
    };

    cleanupRemediationWorktree({
      childEnv,
      repoDir: '/repo',
      runner,
      worktreeDir: '/worktrees/completed',
    });

    assert.deepEqual(calls, [
      {
        args: ['worktree', 'remove', '--force', '/worktrees/completed'],
        command: 'git',
        options: { cwd: '/repo', env: childEnv, shell: false },
      },
    ]);
  });

  it('does nothing when there is no worktree to clean up', () => {
    const calls = [];

    cleanupRemediationWorktree({
      childEnv: {},
      repoDir: '/repo',
      runner: (...args) => calls.push(args),
      worktreeDir: '',
    });

    assert.deepEqual(calls, []);
  });
});
