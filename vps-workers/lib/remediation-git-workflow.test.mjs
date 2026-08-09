import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import { remediationGitWorkflowTestFixtures } from './remediation-git-workflow.test-helpers.mjs';

const { candidate, makeRunner } = remediationGitWorkflowTestFixtures;

describe('remediation git workflow', () => {
  it('runs codex, verifies, pushes, and opens a PR for safe files', () => {
    const { calls, environments, runner } = makeRunner();

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REMEDIATION_RUN_ID: 'run-1',
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
        GH_TOKEN: 'git-provider-token',
        GIT_SSH_COMMAND: 'ssh -i /run/secrets/deploy-key',
        GIT_AUTHOR_EMAIL: 'remediator@example.com',
        GIT_AUTHOR_NAME: 'Baci Remediator',
        GIT_COMMITTER_EMAIL: 'remediator@example.com',
        GIT_COMMITTER_NAME: 'Baci Remediator',
        SSH_AUTH_SOCK: '/run/agent.sock',
        SENTRY_REMEDIATION_AUTH_TOKEN: 'must-not-reach-child-processes',
      },
      prompt: 'Fix this production error.',
      runner,
    });

    assert.equal(result.type, 'pr_opened');
    assert.match(
      result.branch,
      /^codex\/vercel-remediation-unknown-abc123-[a-f0-9]{12}$/
    );
    assert.equal(result.prUrl, 'https://github.com/ogabasseyy/Baci/pull/999');
    assert.deepEqual(result.changedFiles, ['apps/web/src/components/cart.tsx']);
    const prLookup = environments.find(
      ({ args, command }) => command === 'gh' && args.includes('list')
    );
    assert.ok(prLookup);
    assert.equal(prLookup.args[prLookup.args.indexOf('--base') + 1], 'main');
    assert.equal(
      prLookup.args[prLookup.args.indexOf('--head') + 1],
      result.branch
    );
    assert.equal(prLookup.args[prLookup.args.indexOf('--state') + 1], 'open');
    assert.equal(prLookup.env.GH_TOKEN, 'git-provider-token');
    assert.equal('SENTRY_REMEDIATION_AUTH_TOKEN' in prLookup.env, false);
    assert.equal(
      calls.some((call) => call.includes('codex')),
      true
    );
    assert.equal(
      calls.some((call) => call.includes('--ephemeral')),
      true
    );
    assert.equal(
      calls.some((call) => call.includes('use_legacy_landlock')),
      false
    );
    assert.equal(
      calls.some((call) => call.includes('--draft')),
      true
    );
    assert.equal(
      environments.find(({ command }) => command === 'codex')?.timeout,
      6 * 60 * 1000
    );
    assert.equal(
      environments.some(
        ({ command, env }) =>
          command === 'codex' && 'SENTRY_REMEDIATION_AUTH_TOKEN' in env
      ),
      false
    );
    assert.equal(
      environments.some(
        ({ command, env }) =>
          command === 'git' && 'SENTRY_REMEDIATION_AUTH_TOKEN' in env
      ),
      false
    );
    const fetchEnvironment = environments.find(
      ({ args, command }) =>
        command === 'git' && args.join(' ') === 'fetch origin main'
    );
    assert.ok(fetchEnvironment);
    assert.equal(fetchEnvironment.env.GH_TOKEN, 'git-provider-token');
    assert.equal(
      fetchEnvironment.env.GIT_SSH_COMMAND,
      'ssh -i /run/secrets/deploy-key'
    );
    assert.equal(fetchEnvironment.env.SSH_AUTH_SOCK, '/run/agent.sock');
    const commitEnvironment = environments.find(
      ({ args, command }) => command === 'git' && args.includes('commit')
    );
    assert.ok(commitEnvironment);
    assert.equal(commitEnvironment.env.GIT_AUTHOR_NAME, 'Baci Remediator');
    assert.equal(
      commitEnvironment.env.GIT_AUTHOR_EMAIL,
      'remediator@example.com'
    );
    assert.equal(commitEnvironment.env.GIT_COMMITTER_NAME, 'Baci Remediator');
    assert.equal(
      commitEnvironment.env.GIT_COMMITTER_EMAIL,
      'remediator@example.com'
    );
    const pushEnvironment = environments.find(
      ({ args, command }) => command === 'git' && args.includes('push')
    );
    assert.ok(pushEnvironment);
    assert.equal(pushEnvironment.env.GH_TOKEN, 'git-provider-token');
    assert.equal(
      pushEnvironment.env.GIT_SSH_COMMAND,
      'ssh -i /run/secrets/deploy-key'
    );
    assert.equal(
      environments
        .filter(
          ({ args, command }) =>
            command === 'git' &&
            !args.includes('fetch') &&
            !args.includes('ls-remote') &&
            !args.includes('push')
        )
        .every(
          ({ env }) => !('GH_TOKEN' in env) && !('GIT_SSH_COMMAND' in env)
        ),
      true
    );
    assert.equal(
      calls.some(
        (call) =>
          call.join(' ') ===
          `git -c core.hooksPath=/dev/null push -u origin ${result.branch}`
      ),
      true
    );
    assert.equal(
      environments.some(
        ({ command, env }) =>
          command === 'codex' &&
          ('GH_TOKEN' in env ||
            'GIT_SSH_COMMAND' in env ||
            'SSH_AUTH_SOCK' in env ||
            'GIT_AUTHOR_NAME' in env ||
            'GIT_AUTHOR_EMAIL' in env ||
            'GIT_COMMITTER_NAME' in env ||
            'GIT_COMMITTER_EMAIL' in env)
      ),
      false
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
        calls.findIndex((call) => call.includes('push'))
    );
    assert.equal(
      calls.some(
        (call) =>
          call.join(' ') ===
          'git worktree remove --force /worktrees/abc123-run-1'
      ),
      true
    );
  });

  it('redacts a runner failure before it can be reported', () => {
    const { runner: baseRunner } = makeRunner();
    const runner = (command, args, options) => {
      if (command === 'bash') {
        return {
          error: new Error(
            'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz012345'
          ),
        };
      }
      return baseRunner(command, args, options);
    };

    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {
            BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
            BACI_REPO_DIR: '/repo',
            BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
          },
          runner,
        }),
      (error) => {
        assert.doesNotMatch(
          error.message,
          /ghp_abcdefghijklmnopqrstuvwxyz012345/
        );
        assert.match(error.message, /\[REDACTED\]/);
        return true;
      }
    );
  });

  it('never requests automatic merge even when legacy configuration asks for it', () => {
    const { calls, runner } = makeRunner();

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_REQUEST_AUTO_MERGE: '1',
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      runner,
    });

    assert.equal(result.type, 'pr_opened');
    assert.equal(
      calls.some((call) => call.join(' ').includes('pr merge')),
      false
    );
  });

  it('reuses an existing deterministic draft after its create response is lost', () => {
    const { calls, runner: baseRunner } = makeRunner();
    const createdBranches = [];
    let draftCreated = false;
    let lookupAfterCreate = 0;
    const runner = (command, args, options) => {
      if (command === 'gh' && args.includes('list')) {
        if (!draftCreated || lookupAfterCreate++ === 0) {
          return { status: 0, stdout: '[]\n', stderr: '' };
        }
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
