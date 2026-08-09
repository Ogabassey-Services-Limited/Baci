import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import { remediationGitWorkflowTestFixtures } from './remediation-git-workflow.test-helpers.mjs';

const { candidate, makeRunner } = remediationGitWorkflowTestFixtures;

describe('remediation git workflow reconciliation', () => {
  it('reuses an existing deterministic draft after its create response is lost', () => {
    const { calls, runner: baseRunner } = makeRunner();
    const createdBranches = [];
    let draftCreated = false;
    let lookupAfterCreate = 0;
    const runner = (command, args, options) => {
      if (command === 'gh' && args.includes('list')) {
        if (!draftCreated || lookupAfterCreate++ === 0)
          return { status: 0, stdout: '[]\n', stderr: '' };
        return {
          status: 0,
          stdout: '[{"url":"https://github.com/ogabasseyy/Baci/pull/999"}]\n',
          stderr: '',
        };
      }
      if (command === 'gh' && args.includes('create')) {
        draftCreated = true;
        createdBranches.push(args[args.indexOf('--head') + 1]);
        return {
          status: 1,
          stdout: '',
          stderr: 'connection closed before the draft URL was returned',
        };
      }
      return baseRunner(command, args, options);
    };
    const env = {
      BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
      BACI_REPO_DIR: '/repo',
      BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
    };

    assert.throws(
      () => runRemediationAutofix({ candidate, env, runner }),
      /connection closed before the draft URL was returned/
    );
    const retried = runRemediationAutofix({ candidate, env, runner });

    assert.equal(retried.type, 'pr_opened');
    assert.equal(retried.prUrl, 'https://github.com/ogabasseyy/Baci/pull/999');
    assert.equal(retried.branch, createdBranches[0]);
    assert.equal(calls.filter((call) => call.includes('codex')).length, 1);
    assert.equal(createdBranches.length, 1);
  });

  it('uses a new deterministic branch when a case observation advances', () => {
    const { calls, runner } = makeRunner();
    const observed = {
      ...candidate,
      caseKey: 'vercel:vercel_runtime_exception:abc123',
      category: 'vercel_runtime_exception',
      observationMarker: '2026-08-09T10:00:00.000Z',
      source: 'vercel',
    };
    const env = {
      BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
      BACI_REPO_DIR: '/repo',
      BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
    };

    const first = runRemediationAutofix({ candidate: observed, env, runner });
    const recurrence = runRemediationAutofix({
      candidate: {
        ...observed,
        lastSeen: '2026-08-09T10:05:00.000Z',
        observationMarker: '2026-08-09T10:05:00.000Z',
      },
      env,
      runner,
    });

    assert.notEqual(first.branch, recurrence.branch);
    assert.equal(calls.filter((call) => call.includes('codex')).length, 2);
    assert.equal(
      calls.filter((call) => call.join(' ').includes('pr create')).length,
      2
    );
  });
});
