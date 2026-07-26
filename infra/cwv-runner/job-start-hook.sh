#!/bin/sh
set -eu
umask 077

# Closed selection: GITHUB_REPOSITORY GITHUB_REPOSITORY_ID GITHUB_WORKFLOW_REF GITHUB_WORKFLOW_SHA GITHUB_REF GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT GITHUB_JOB RUNNER_NAME RUNNER_OS RUNNER_ARCH
exec /opt/runner/externals/node24/bin/node --input-type=module - <<'HOOK_NODE'
import { Worker } from 'node:worker_threads';

const WATCHDOG_TIMEOUT_MS = 5_000;

function validateJobStart() {
  const { createHash } = require('node:crypto');
  const {
    closeSync,
    constants,
    fstatSync,
    openSync,
    readFileSync,
  } = require('node:fs');
  const ALLOW_PATH = '/run/baci-cwv-admission/active.json';
  const POLICY_PATH = '/opt/baci-cwv/policy.json';
  const HEX_40 = /^[a-f0-9]{40}$/;
  const HEX_64 = /^[a-f0-9]{64}$/;
  const NAMES = Object.freeze([
    'GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_WORKFLOW_REF',
    'GITHUB_WORKFLOW_SHA', 'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT', 'GITHUB_JOB', 'RUNNER_NAME', 'RUNNER_OS', 'RUNNER_ARCH',
  ]);

  function fail(message) {
    throw new Error(message);
  }

  function exactKeys(value, expected, name) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      fail(`${name} must be an object`);
    const actual = Object.keys(value).sort();
    const closed = [...expected].sort();
    if (actual.length !== closed.length || actual.some((key, index) => key !== closed[index]))
      fail(`${name} keys are not exact`);
  }

  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object')
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }

  function identity(metadata) {
    return `${metadata.dev}:${metadata.ino}:${metadata.uid}:${metadata.gid}:${metadata.mode}:${metadata.size}`;
  }

  function readOpened(path, maximumBytes, metadataValid, label) {
    let descriptor;
    try {
      descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const before = fstatSync(descriptor, { bigint: false });
      if (!before.isFile() || before.isSymbolicLink() || !metadataValid(before))
        fail(`${label} metadata is invalid`);
      if (before.size < 2 || before.size > maximumBytes)
        fail(`${label} size is invalid`);
      const text = readFileSync(descriptor, 'utf8');
      const after = fstatSync(descriptor, { bigint: false });
      if (
        identity(after) !== identity(before) ||
        Buffer.byteLength(text) !== before.size
      )
        fail(`${label} changed while open`);
      return text;
    } catch {
      fail(`${label} metadata is invalid`);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  function readClosed(path, maximumBytes, owner, group, mode) {
    return readOpened(
      path,
      maximumBytes,
      (metadata) =>
        metadata.uid === owner &&
        metadata.gid === group &&
        (metadata.mode & 0o777) === mode,
      'guard input'
    );
  }

  function monotonicSeconds() {
    const value = Number.parseFloat(readFileSync('/proc/uptime', 'utf8').split(' ', 1)[0]);
    if (!Number.isFinite(value) || value < 0) fail('monotonic clock is invalid');
    return value;
  }

  const start = monotonicSeconds();
  const selected = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
  if (Object.values(selected).some((value) => typeof value !== 'string' || value === ''))
    fail('named job context is incomplete');

  const policyText = readClosed(POLICY_PATH, 262_144, 0, 0, 0o444);
  const policy = JSON.parse(policyText);
  const hookTimeoutSeconds = policy?.repositoryAuthority?.hookTimeoutSeconds;
  if (hookTimeoutSeconds !== 5) fail('hook timeout policy is invalid');

  const allowText = readClosed(ALLOW_PATH, 32_768, 0, 10_001, 0o440);
  const allow = JSON.parse(allowText);
  if (`${canonical(allow)}\n` !== allowText) fail('allow record is not canonical');
  exactKeys(allow, ['admissionId', 'campaignId', 'expectedSha', 'expiresMonotonicSeconds', 'kind', 'policyFileSha256', 'repository', 'run', 'runner', 'schemaVersion', 'workflow'], 'allow');
  exactKeys(allow.repository, ['id', 'name'], 'repository');
  exactKeys(allow.run, ['attempt', 'id'], 'run');
  exactKeys(allow.runner, ['generation', 'id', 'name'], 'runner');
  exactKeys(allow.workflow, ['id', 'job', 'path', 'ref'], 'workflow');
  if (allow.schemaVersion !== 1 || allow.kind !== 'allow' || !HEX_64.test(allow.admissionId) || !HEX_40.test(allow.expectedSha))
    fail('allow record identity is invalid');
  if (!Number.isFinite(allow.expiresMonotonicSeconds)) fail('allow expiry is invalid');
  if (!Number.isInteger(allow.runner.id) || allow.runner.id < 1 || allow.runner.generation !== 1 || allow.runner.name !== 'baci-cwv-measurement-01' || allow.runner.name !== process.env.RUNNER_NAME || process.env.RUNNER_OS !== 'Linux' || process.env.RUNNER_ARCH !== 'X64')
    fail('runner identity binding mismatch');
  if (!HEX_64.test(allow.policyFileSha256) || createHash('sha256').update(policyText).digest('hex') !== allow.policyFileSha256)
    fail('policy binding mismatch');

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (typeof eventPath !== 'string' || !eventPath.startsWith('/github/workflow/'))
    fail('event path is invalid');
  const event = JSON.parse(
    readOpened(eventPath, 1_048_576, () => true, 'event input')
  );
  const admissionId = event?.inputs?.admission_id;
  if (admissionId !== allow.admissionId) fail('admission input binding mismatch');

  const expected = Object.freeze({
    GITHUB_JOB: allow.workflow.job,
    GITHUB_REF: allow.workflow.ref,
    GITHUB_REPOSITORY: allow.repository.name,
    GITHUB_REPOSITORY_ID: String(allow.repository.id),
    GITHUB_RUN_ATTEMPT: String(allow.run.attempt),
    GITHUB_RUN_ID: String(allow.run.id),
    GITHUB_SHA: allow.expectedSha,
    GITHUB_WORKFLOW_REF: `${allow.repository.name}/${allow.workflow.path}@${allow.workflow.ref}`,
    GITHUB_WORKFLOW_SHA: allow.expectedSha,
  });
  for (const [name, expectedValue] of Object.entries(expected))
    if (selected[name] !== expectedValue) fail(`job context binding mismatch: ${name}`);

  const finish = monotonicSeconds();
  if (start > allow.expiresMonotonicSeconds || finish > allow.expiresMonotonicSeconds)
    fail('allow record expired');
  const receipt = createHash('sha256').update(allowText).digest('hex');
  return `${JSON.stringify({ ok: true, receipt })}\n`;
}

const workerSource = `
const { parentPort } = require('node:worker_threads');
const validateJobStart = ${validateJobStart.toString()};
try {
  parentPort.postMessage({ ok: true, output: validateJobStart() });
} catch (error) {
  parentPort.postMessage({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
    ok: false,
  });
}`;
let worker;
let settled = false;
const watchdog = setTimeout(() => {
  if (settled) return;
  settled = true;
  void worker.terminate();
  process.exit(124);
}, WATCHDOG_TIMEOUT_MS);
try {
  worker = new Worker(workerSource, { eval: true, execArgv: [] });
} catch (error) {
  clearTimeout(watchdog);
  throw error;
}
worker.once('message', (result) => {
  if (settled) return;
  settled = true;
  clearTimeout(watchdog);
  if (result?.ok !== true || typeof result.output !== 'string') {
    process.stderr.write(`${result?.error ?? 'job-start hook validation failed'}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(result.output);
});
worker.once('error', (error) => {
  if (settled) return;
  settled = true;
  clearTimeout(watchdog);
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
worker.once('exit', (code) => {
  if (settled) return;
  settled = true;
  clearTimeout(watchdog);
  process.stderr.write(`job-start hook worker exited before validation: ${code}\n`);
  process.exitCode = 1;
});
HOOK_NODE
