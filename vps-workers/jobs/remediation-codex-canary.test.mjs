import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runRemediationCodexCanary } from './remediation-codex-canary.mjs';

describe('remediation Codex canary', () => {
  it('exits as a sanitized skip unless explicitly enabled', () => {
    const result = runRemediationCodexCanary({ env: {} });

    assert.deepEqual(result, { skipped: true, type: 'canary_skipped' });
  });

  it('fails closed when the pinned Docker image is not configured', () => {
    assert.throws(
      () =>
        runRemediationCodexCanary({
          env: {
            BACI_REMEDIATION_CANARY_ENABLED: '1',
            BACI_CODEX_CONTAINER_BIN: '/opt/host/codex-native',
            BACI_REPO_DIR: '/repo',
          },
        }),
      /BACI_CODEX_DOCKER_IMAGE is required/
    );
  });

  it('fails closed when the native container Codex binary is not configured', () => {
    assert.throws(
      () =>
        runRemediationCodexCanary({
          env: {
            BACI_REMEDIATION_CANARY_ENABLED: '1',
            BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
            BACI_REPO_DIR: '/repo',
          },
        }),
      /BACI_CODEX_CONTAINER_BIN is required/
    );
  });

  it('uses the remediation image in a read-only mode without git or provider mutations', () => {
    const calls = [];
    const result = runRemediationCodexCanary({
      env: {
        BACI_REMEDIATION_CANARY_ENABLED: '1',
        BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
        BACI_CODEX_CONTAINER_BIN: '/opt/host/codex-native',
        BACI_REPO_DIR: '/repo',
        CODEX_HOME: '/home/worker/.codex',
        HOME: '/home/worker',
      },
      runner(command, args, options) {
        calls.push({ args, command, options });
        return {
          status: 0,
          stderr: '',
          stdout: '{"type":"turn.completed"}\n',
        };
      },
    });

    assert.equal(result.type, 'canary_completed');
    assert.deepEqual(
      calls.map(({ command }) => command),
      ['docker', 'docker']
    );
    assert.equal(calls[0].args.includes('--read-only'), true);
    assert.equal(calls[0].args.includes('--json'), true);
    assert.equal(calls[0].args.includes('--sandbox'), true);
    assert.equal(calls[0].args.includes('read-only'), true);
    assert.equal(
      calls[0].args.includes('--dangerously-bypass-approvals-and-sandbox'),
      false
    );
    assert.equal(
      calls[0].args.includes('type=bind,src=/repo,dst=/repo,readonly'),
      true
    );
    assert.equal(
      calls.some(
        ({ args, command }) =>
          ['git', 'gh'].includes(command) ||
          args.some((value) =>
            ['worktree', 'commit', 'push', 'pr', 'create'].includes(value)
          )
      ),
      false
    );
    assert.deepEqual(calls[1].args, ['rm', '-f', 'baci-remediation-repo']);
  });

  it('uses the default timeout for a non-integer canary timeout', () => {
    const calls = [];

    runRemediationCodexCanary({
      env: {
        BACI_REMEDIATION_CANARY_ENABLED: '1',
        BACI_CODEX_CANARY_TIMEOUT_MS: '1.5',
        BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
        BACI_CODEX_CONTAINER_BIN: '/opt/host/codex-native',
        BACI_REPO_DIR: '/repo',
        CODEX_HOME: '/home/worker/.codex',
        HOME: '/home/worker',
      },
      runner(command, args, options) {
        calls.push({ args, command, options });
        return { status: 0, stderr: '', stdout: '{"type":"turn.completed"}\n' };
      },
    });

    assert.equal(calls[0].options.timeout, 60_000);
  });

  it('does not misclassify an authoring failure as authentication', () => {
    const result = spawnSync(
      process.execPath,
      ['jobs/remediation-codex-canary.mjs'],
      {
        cwd: join(import.meta.dirname, '..'),
        encoding: 'utf8',
        env: {
          ...process.env,
          BACI_REMEDIATION_CANARY_ENABLED: '1',
          BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
          BACI_CODEX_CONTAINER_BIN: '/opt/host/codex-native',
          BACI_REPO_DIR: '/repo',
          BACI_REMEDIATION_NOTIFY_EMAILS: '',
          DOCKER_BIN: '/does-not-exist/authored-docker',
          ZEPTOMAIL_TOKEN: '',
        },
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stdout, /canary_toolchain_failed/);
    assert.doesNotMatch(result.stdout, /canary_auth_failed/);
  });
});
