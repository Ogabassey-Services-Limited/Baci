import { redactCodexError } from './remediation-codex-output.mjs';

export function isDockerImageUnavailable(error) {
  return /(?:unable to find image|pull access denied|image .* not found|manifest unknown|repository does not exist)/i.test(
    String(error?.message || error || '')
  );
}

export function assertDockerImageAvailable({ image, runner, options }) {
  const dockerBin = options.env.DOCKER_BIN || 'docker';
  const result = runner(dockerBin, ['image', 'inspect', '--', image], {
    ...options,
    shell: false,
  });
  if (result.error) throw redactCodexError(result.error);
  if (result.status !== 0) {
    throw new Error(
      'configured BACI_CODEX_DOCKER_IMAGE is unavailable; deploy the pinned remediator image before enabling autofix'
    );
  }
}
