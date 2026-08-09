import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasRetainedRemediationWorktree } from './remediation-retained-worktree.mjs';

describe('retained remediation worktree lookup', () => {
  it('finds the exact registered worktree and branch', () => {
    const runner = () => ({
      status: 0,
      stdout:
        'worktree /repo\nHEAD deadbeef\nbranch refs/heads/main\n\nworktree /worktrees/abc123-retry-run\nHEAD deadbeef\nbranch refs/heads/codex/fix-abc123\n',
      stderr: '',
    });

    const result = hasRetainedRemediationWorktree({
      branch: 'codex/fix-abc123',
      childEnv: {},
      repoDir: '/repo',
      runner,
      worktreeDir: '/worktrees/abc123-retry-run',
    });

    assert.equal(result, true);
  });

  it('does not reuse a worktree registered to another branch', () => {
    const runner = () => ({
      status: 0,
      stdout:
        'worktree /worktrees/abc123-retry-run\nHEAD deadbeef\nbranch refs/heads/codex/other-fix\n',
      stderr: '',
    });

    const result = hasRetainedRemediationWorktree({
      branch: 'codex/fix-abc123',
      childEnv: {},
      repoDir: '/repo',
      runner,
      worktreeDir: '/worktrees/abc123-retry-run',
    });

    assert.equal(result, false);
  });
});
