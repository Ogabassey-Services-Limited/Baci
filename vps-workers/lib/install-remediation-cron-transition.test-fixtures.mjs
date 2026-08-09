import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export function writeExecutable(path, source) {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

export function writeJob(path, source = 'process.exitCode = 0;\n') {
  writeFileSync(path, source);
}

export function waitFor(path) {
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(path)) return;
    Atomics.wait(waiter, 0, 0, 10);
  }
  throw new Error(`timed out waiting for ${path}`);
}

export function writeStage(
  stageDirectory,
  globalLockSource,
  transactionSource
) {
  const jobs = join(stageDirectory, 'jobs');
  const lib = join(stageDirectory, 'lib');
  mkdirSync(jobs, { recursive: true });
  mkdirSync(lib, { recursive: true });
  writeFileSync(
    join(lib, 'remediation-global-lock.mjs'),
    readFileSync(globalLockSource)
  );
  writeFileSync(
    join(lib, 'remediation-cron-transition.py'),
    readFileSync(transactionSource)
  );
  for (const name of [
    'vercel-error-remediator',
    'sentry-mobile-error-remediator',
    'remediation-codex-canary',
  ]) {
    writeJob(
      join(jobs, `${name}.mjs`),
      "import { existsSync } from 'node:fs';\nprocess.exitCode = existsSync(process.env.BARRIER_MARKER) ? 75 : 0;\n"
    );
  }
}
