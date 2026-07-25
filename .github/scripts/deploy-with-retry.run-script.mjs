import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('deploy-with-retry.sh', import.meta.url)
);

// Runs deploy-with-retry.sh against the fake-command PATH built by
// makeFakeCommand, with fast retries so tests stay quick.
export function runScript(fakeCommand, commandArgs = ['fake-vercel', 'deploy']) {
  return spawnSync('bash', [scriptPath, ...commandArgs], {
    cwd: fakeCommand.tempDir,
    env: {
      ...process.env,
      BACKOFF_SECONDS: '0',
      MAX_ATTEMPTS: '2',
      PATH: `${fakeCommand.binDir}:${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8',
  });
}
