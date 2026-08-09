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

  it('discovers and cleans the registered deterministic branch worktree', () => {
    const calls = [];
    const runner = (command, args, options) => {
      calls.push({ args, command, options });
      if (args.join(' ') === 'worktree list --porcelain') {
        return {
          status: 0,
          stdout:
            'worktree /worktrees/lost-pr-create\nHEAD deadbeef\nbranch refs/heads/codex/fix-abc123\n',
          stderr: '',
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    };

    const result = cleanupRemediationWorktree({
      branch: 'codex/fix-abc123',
      childEnv: {},
      repoDir: '/repo',
      runner,
    });

    assert.equal(result, '/worktrees/lost-pr-create');
    assert.equal(
      calls.at(-1).args.join(' '),
      'worktree remove --force /worktrees/lost-pr-create'
    );
  });
});
