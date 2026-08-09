import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import { remediationGitWorkflowTestFixtures } from './remediation-git-workflow.test-helpers.mjs';

const { candidate, makeRunner } = remediationGitWorkflowTestFixtures;

describe('remediation committed-branch retry', () => {
  it('resumes push and PR creation without rerunning Codex after a push failure', () => {
    const { calls, runner: baseRunner } = makeRunner();
    let codexAttempts = 0;
    let pushAttempts = 0;
    let retainedWorktree;
    const runner = (command, args, options) => {
      if (command === 'git' && args[0] === 'worktree' && args[1] === 'add') {
        retainedWorktree = {
          branch: args[args.indexOf('-b') + 1],
          directory: args[2],
        };
      }
      if (command === 'git' && args.join(' ') === 'worktree list --porcelain') {
        return {
          status: 0,
          stdout: retainedWorktree
            ? `worktree ${retainedWorktree.directory}\nHEAD deadbeef\nbranch refs/heads/${retainedWorktree.branch}\n`
            : 'worktree /repo\nHEAD deadbeef\nbranch refs/heads/main\n',
          stderr: '',
        };
      }
      if (
        command === 'git' &&
        args.join(' ') === 'rev-list --count origin/main..HEAD'
      ) {
        return { status: 0, stdout: '1\n', stderr: '' };
      }
      if (command === 'git' && args.includes('push') && pushAttempts++ === 0) {
        return { status: 1, stdout: '', stderr: 'push network unavailable' };
      }
      if (command === 'codex') codexAttempts++;
      return baseRunner(command, args, options);
    };
    const env = {
      BACI_REMEDIATION_RUN_ID: 'push-retry',
      BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
      BACI_REPO_DIR: '/repo',
      BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
    };

    assert.throws(
      () => runRemediationAutofix({ candidate, env, runner }),
      /push network unavailable/
    );
    const retried = runRemediationAutofix({ candidate, env, runner });

    assert.equal(retried.type, 'pr_opened');
    assert.equal(codexAttempts, 1);
    assert.equal(pushAttempts, 2);
    assert.equal(
      calls.filter((call) => call.join(' ').startsWith('git worktree add'))
        .length,
      1
    );
    assert.equal(
      calls.some(
        (call) =>
          call.join(' ') ===
          `git worktree remove --force ${retainedWorktree.directory}`
      ),
      true
    );
  });
});
