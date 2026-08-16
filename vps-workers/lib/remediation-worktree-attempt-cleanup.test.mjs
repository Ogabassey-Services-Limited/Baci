import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanupRemediationAttempt } from './remediation-worktree-attempt-cleanup.mjs';

describe('remediation worktree attempt cleanup', () => {
  it('removes an uncommitted failed attempt by default', () => {
    const calls = [];
    const runner = (command, args) => {
      calls.push([command, ...args]);
      if (args.join(' ') === 'worktree list --porcelain') {
        return { status: 0, stdout: 'worktree /worktrees/failed\n' };
      }
      return { status: 0, stdout: '' };
    };

    cleanupRemediationAttempt(
      {
        childEnv: {},
        repoDir: '/repo',
        runner,
        worktreeDir: '/worktrees/failed',
      },
      false,
      true,
      false,
      false
    );

    assert.equal(
      calls.some((call) => call.includes('remove')),
      true
    );
  });

  it('keeps a committed failed attempt but removes its pnpm store', () => {
    const calls = [];
    const runner = (command, args) => {
      calls.push([command, ...args]);
      if (args.join(' ') === 'worktree list --porcelain') {
        return { status: 0, stdout: 'worktree /worktrees/committed\n' };
      }
      return { status: 0, stdout: '' };
    };

    cleanupRemediationAttempt(
      {
        childEnv: {},
        repoDir: '/repo',
        runner,
        worktreeDir: '/worktrees/committed',
      },
      false,
      true,
      true,
      false
    );

    assert.deepEqual(calls, [
      ['git', 'worktree', 'list', '--porcelain'],
      ['rm', '-rf', '--', '/worktrees/committed-pnpm-store'],
    ]);
  });
});
