import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDockerImageAvailable,
  isDockerImageUnavailable,
} from './remediation-docker-image.mjs';

describe('remediation Docker image guard', () => {
  it('checks the configured image without invoking a shell', () => {
    const calls = [];
    assertDockerImageAvailable({
      image: 'baci-codex-remediator:sha',
      options: { env: { DOCKER_BIN: 'docker' }, cwd: '/repo' },
      runner(command, args, options) {
        calls.push({ args, command, options });
        return { status: 0, stderr: '', stdout: '' };
      },
    });

    assert.deepEqual(calls, [
      {
        args: ['image', 'inspect', '--', 'baci-codex-remediator:sha'],
        command: 'docker',
        options: { cwd: '/repo', env: { DOCKER_BIN: 'docker' }, shell: false },
      },
    ]);
  });

  it('blocks before worktree creation when the configured image is missing', () => {
    assert.throws(
      () =>
        assertDockerImageAvailable({
          image: 'baci-codex-remediator:sha',
          options: { env: {} },
          runner: () => ({
            status: 1,
            stderr: 'pull access denied',
            stdout: '',
          }),
        }),
      /configured BACI_CODEX_DOCKER_IMAGE is unavailable/
    );
  });

  it('uses the configured Docker binary during image preflight', () => {
    const calls = [];
    assertDockerImageAvailable({
      dockerBin: '/opt/bin/docker-wrapper',
      image: 'baci-codex-remediator:sha',
      options: { env: {} },
      runner(command, args) {
        calls.push({ args, command });
        return { status: 0, stderr: '', stdout: '' };
      },
    });

    assert.equal(calls[0].command, '/opt/bin/docker-wrapper');
  });

  it('recognizes Docker image launch failures for cleanup', () => {
    assert.equal(
      isDockerImageUnavailable(
        new Error('Unable to find image baci-codex-remediator:sha locally')
      ),
      true
    );
    assert.equal(isDockerImageUnavailable(new Error('Codex timed out')), false);
  });
});
