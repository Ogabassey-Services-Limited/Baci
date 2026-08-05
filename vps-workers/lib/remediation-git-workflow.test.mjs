import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    assert.equal(result.branch, 'codex/vercel-remediation-abc123-run-1');
    assert.equal(result.prUrl, 'https://github.com/ogabasseyy/Baci/pull/999');
    assert.deepEqual(result.changedFiles, ['apps/web/src/components/cart.tsx']);
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
          'git -c core.hooksPath=/dev/null push -u origin codex/vercel-remediation-abc123-run-1'
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

  it('preserves Codex output when an investigation makes no changes', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-output-'));
    const { runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) => {
      if (command === 'codex') {
        return {
          status: 0,
          stdout: 'The event is a successful HTTP 200 and needs no code fix.\n',
          stderr: '',
        };
      }
      return baseRunner(command, args, options);
    };

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REMEDIATION_OUTPUT_DIR: outputDir,
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_RUN_ID: 'report-run',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      runner,
    });

    assert.equal(result.type, 'no_changes');
    assert.equal(result.resultPath, join(outputDir, 'abc123.result.md'));
    assert.match(
      readFileSync(result.resultPath, 'utf8'),
      /successful HTTP 200/
    );
  });

  it('rejects a sandbox-blocked investigation before marking it handled', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-output-'));
    const { runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) =>
      command === 'codex'
        ? {
            status: 0,
            stdout:
              'bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted',
            stderr: '',
          }
        : baseRunner(command, args, options);

    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {
            BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
            BACI_REMEDIATION_OUTPUT_DIR: outputDir,
            BACI_REPO_DIR: '/repo',
            BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
          },
          runner,
        }),
      /sandbox failed before repository inspection/
    );
  });

  it('runs Codex in Docker when the VPS backend is configured', () => {
    const { calls, runner } = makeRunner({ statusOutput: '' });

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
        BACI_CODEX_CONTAINER_BIN: '/opt/host/codex-native',
        BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
        BACI_REMEDIATION_OUTPUT_DIR: mkdtempSync(
          join(tmpdir(), 'baci-remediation-output-')
        ),
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
        CODEX_BIN: '/opt/host/codex',
        CODEX_HOME: '/home/worker/.codex',
        HOME: '/home/worker',
      },
      runner,
    });

    assert.equal(result.type, 'no_changes');
    const dockerCall = calls.find(([command]) => command === 'docker');
    assert.ok(dockerCall);
    assert.equal(dockerCall.includes('--cap-drop'), true);
    assert.equal(dockerCall.includes('ALL'), true);
    assert.equal(
      dockerCall.includes('--dangerously-bypass-approvals-and-sandbox'),
      true
    );
  });
});
