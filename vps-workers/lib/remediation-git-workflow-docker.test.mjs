import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import { remediationGitWorkflowTestFixtures } from './remediation-git-workflow.test-helpers.mjs';

const { candidate, makeRunner } = remediationGitWorkflowTestFixtures;
const dockerEnvironment = {
  BACI_CODEX_DOCKER_IMAGE: 'baci-codex-remediator:local',
  BACI_CODEX_CONTAINER_BIN: '/opt/host/codex-native',
  BACI_REMEDIATION_VERIFY_COMMAND: 'pnpm turbo lint',
  BACI_REPO_DIR: '/repo',
  BACI_REMEDIATION_WORKTREE_ROOT: '/worktrees',
  CODEX_HOME: '/home/worker/.codex',
  HOME: '/home/worker',
};

describe('remediation Docker workflow', () => {
  it('runs Codex in a hardened Docker container', () => {
    const { calls, runner } = makeRunner({ statusOutput: '' });
    const result = runRemediationAutofix({
      candidate,
      env: {
        ...dockerEnvironment,
        BACI_REMEDIATION_OUTPUT_DIR: mkdtempSync(
          join(tmpdir(), 'baci-remediation-output-')
        ),
      },
      runner,
    });

    assert.equal(result.type, 'no_changes');
    const dockerCall = calls.find(
      ([command, ...args]) =>
        command === 'docker' &&
        args.includes('--dangerously-bypass-approvals-and-sandbox')
    );
    assert.ok(dockerCall);
    assert.equal(dockerCall.includes('--cap-drop'), true);
    assert.equal(dockerCall.includes('ALL'), true);
    assert.equal(
      dockerCall.includes('--dangerously-bypass-approvals-and-sandbox'),
      true
    );
    assert.equal(
      calls.some(
        ([command, ...args]) =>
          command === 'docker' &&
          args.includes('--sandbox') &&
          args.includes('read-only') &&
          args.includes('--read-only')
      ),
      true
    );
    assert.equal(
      calls.some(
        (call) =>
          call.slice(0, 3).join(' ') === 'docker rm -f' &&
          call[3]?.startsWith('baci-remediation-abc123-')
      ),
      true
    );
  });

  it('runs verification with dependency mounts', () => {
    const { calls, runner } = makeRunner();
    const worktreeRoot = mkdtempSync(
      join(tmpdir(), 'baci-remediation-worktrees-')
    );
    const dependencyRoot = mkdtempSync(
      join(tmpdir(), 'baci-remediation-dependencies-')
    );
    mkdirSync(join(dependencyRoot, 'node_modules'));
    const result = runRemediationAutofix({
      candidate,
      env: {
        ...dockerEnvironment,
        BACI_REMEDIATION_WORKTREE_ROOT: worktreeRoot,
        BACI_REMEDIATION_DEPENDENCY_ROOT: dependencyRoot,
        BACI_REMEDIATION_RUN_ID: 'verify-run',
      },
      runner,
    });

    assert.equal(result.type, 'pr_opened');
    const verificationCall = calls.find(
      ([command, ...args]) =>
        command === 'docker' &&
        args.some((arg) => arg.includes('pnpm turbo lint'))
    );
    assert.ok(verificationCall);
    assert.equal(
      verificationCall.includes(
        `type=bind,src=${dependencyRoot}/node_modules,dst=/opt/remediation-dependencies/node_modules,readonly`
      ),
      true
    );
    const verificationScript = verificationCall.at(-1);
    const verifyPosition = verificationScript.lastIndexOf('pnpm turbo lint');
    assert.ok(verificationScript.indexOf('cp -a') < verifyPosition);
    for (const relativePath of [
      'node_modules',
      'apps/web/node_modules',
      'apps/mobile-admin/node_modules',
      'apps/mobile-storefront/node_modules',
    ]) {
      assert.match(
        verificationScript,
        new RegExp(`cp -a \\"/opt/remediation-dependencies/${relativePath}`)
      );
    }
    assert.match(verificationScript, / && pnpm turbo lint$/);
    assert.equal(
      verificationCall.includes('pnpm_config_store_dir=/pnpm-store'),
      true
    );
    assert.equal(
      calls.some((call) => call.join(' ') === 'bash -lc pnpm turbo lint'),
      false
    );
  });

  it('force-removes a Docker container when Codex times out', () => {
    const { calls, runner: baseRunner } = makeRunner({ statusOutput: '' });
    const runner = (command, args, options) => {
      const result = baseRunner(command, args, options);
      return command === 'docker' && args[0] === 'run'
        ? { error: new Error('spawnSync docker ETIMEDOUT') }
        : result;
    };

    assert.throws(
      () =>
        runRemediationAutofix({
          candidate,
          env: {
            ...dockerEnvironment,
            BACI_REMEDIATION_RUN_ID: 'timeout-run',
          },
          runner,
        }),
      /ETIMEDOUT/
    );
    assert.equal(
      calls.some(
        (call) =>
          call.join(' ') === 'docker rm -f baci-remediation-abc123-timeout-run'
      ),
      true
    );
  });
});
