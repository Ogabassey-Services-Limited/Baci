import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';

const candidate = {
  fingerprint: 'abc123',
  occurrences: 3,
  sample: {
    message: 'TypeError: Cannot read properties of undefined',
    route: '/api/products',
  },
};

function makeRunner({
  changedFiles = 'apps/web/src/components/cart.tsx\n',
} = {}) {
  const calls = [];
  return {
    calls,
    runner(command, args) {
      calls.push([command, ...args]);
      const joined = [command, ...args].join(' ');
      if (joined.includes('status --porcelain')) {
        return {
          status: 0,
          stdout: changedFiles
            .split('\n')
            .filter(Boolean)
            .map((path) => ` M ${path}`)
            .join('\n'),
          stderr: '',
        };
      }
      if (joined.includes('pr create')) {
        return {
          status: 0,
          stdout: 'https://github.com/ogabasseyy/Baci/pull/999\n',
          stderr: '',
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  };
}

describe('remediation git workflow', () => {
  it('runs codex, verifies, pushes, and opens a PR for safe files', () => {
    const { calls, runner } = makeRunner();

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      prompt: 'Fix this production error.',
      runner,
    });

    assert.equal(result.type, 'pr_opened');
    assert.equal(result.prUrl, 'https://github.com/ogabasseyy/Baci/pull/999');
    assert.deepEqual(result.changedFiles, ['apps/web/src/components/cart.tsx']);
    assert.equal(
      calls.some((call) => call.includes('codex')),
      true
    );
    assert.equal(
      calls.some((call) => call.includes('push')),
      true
    );
    assert.equal(
      calls.some((call) => call.includes('worktree')),
      true
    );
    assert.ok(
      calls.findIndex((call) => call.join(' ') === 'bash -lc pnpm turbo lint') <
        calls.findIndex((call) => call.join(' ').includes('git push'))
    );
  });

  it('blocks PR creation when protected files changed', () => {
    const { calls, runner } = makeRunner({
      changedFiles: 'apps/web/src/proxy.ts\n',
    });

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      prompt: 'Fix this production error.',
      runner,
    });

    assert.equal(result.type, 'policy_blocked');
    assert.match(result.reasons.join('\n'), /protected path/);
    assert.equal(
      calls.some((call) => call.includes('push')),
      false
    );
  });

  it('blocks safe changes when no verification command is configured', () => {
    const { calls, runner } = makeRunner();

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      prompt: 'Fix this production error.',
      runner,
    });

    assert.equal(result.type, 'policy_blocked');
    assert.match(result.reasons.join('\n'), /VERIFY_COMMAND/);
    assert.equal(
      calls.some((call) => call.includes('push')),
      false
    );
  });

  it('requires an explicit repo checkout', () => {
    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {},
          prompt: 'Fix this production error.',
          runner: makeRunner().runner,
        }),
      /BACI_REPO_DIR is required/
    );
  });
});
