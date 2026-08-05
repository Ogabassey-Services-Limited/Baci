import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function makeRunner({ changedFiles, statusOutput } = {}) {
  const calls = [];
  const environments = [];
  return {
    calls,
    environments,
    runner(command, args, options) {
      calls.push([command, ...args]);
      environments.push({ args, command, env: options?.env || {} });
      const joined = [command, ...args].join(' ');
      if (joined.includes('status --porcelain')) {
        return {
          status: 0,
          stdout:
            statusOutput ??
            (changedFiles ?? 'apps/web/src/components/cart.tsx\n')
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
      calls.some((call) => call.includes('--draft')),
      true
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
    assert.equal(
      calls.some((call) => call.includes('remove')),
      true
    );
  });

  it('blocks protected rename sources before PR creation', () => {
    const { calls, runner } = makeRunner({
      statusOutput: 'R  apps/web/src/proxy.ts -> apps/web/src/proxy-safe.ts',
    });

    const result = runRemediationAutofix({
      candidate,
      env: {
        BACI_REPO_DIR: '/repo',
        BACI_REMEDIATION_RUN_ID: 'rename-run',
        BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
      },
      prompt: 'Fix this production error.',
      runner,
    });

    assert.equal(result.type, 'policy_blocked');
    assert.deepEqual(result.changedFiles, [
      'apps/web/src/proxy.ts',
      'apps/web/src/proxy-safe.ts',
    ]);
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
