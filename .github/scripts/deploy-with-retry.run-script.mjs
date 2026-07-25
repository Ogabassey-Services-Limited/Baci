import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('deploy-with-retry.sh', import.meta.url)
);

// Runs deploy-with-retry.sh against the fake-command PATH built by
// makeFakeCommand, with fast retries so tests stay quick. `extraEnv` overrides
// or adds environment variables (e.g. a short DEPLOY_ATTEMPT_TIMEOUT_SECONDS).
export function runScript(
  fakeCommand,
  commandArgs = ['fake-vercel', 'deploy'],
  extraEnv = {}
) {
  return spawnSync('bash', [scriptPath, ...commandArgs], {
    cwd: fakeCommand.tempDir,
    env: {
      ...process.env,
      BACKOFF_SECONDS: '0',
      MAX_ATTEMPTS: '2',
      ...extraEnv,
      PATH: `${fakeCommand.binDir}:${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8',
  });
}
