import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as osConstants } from 'node:os';
import { join } from 'node:path';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { parseCanonicalCommandSettingsReceipt } from './command-settings-contract.mjs';
import { parseCanonicalNormalRelease } from './normal-release.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { parseCanonicalRegistrationRelease } from './registration-release.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => {
  throw new TypeError(message);
};
const digest = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
// biome-ignore format: the exact sealed-receipt key inventory preserves the runtime line cap.
const runtimeMapKeys = ['entries', 'phases', 'receiptBinding', 'schemaVersion', 'sealed'];
// biome-ignore format: the exact sealed-receipt key inventory preserves the runtime line cap.
const runtimeMapEntryKeys = ['maxInstancesByPhase', 'mode', 'owner', 'path', 'realpath', 'role', 'sha256'];
const runtimeMapSealedKeys = ['mode', 'owner', 'path', 'realpath', 'sha256'];
const validRuntimeMapMember = (entry, keys, hasPhaseLimit) =>
  exactKeys(entry, keys) &&
  typeof entry.path === 'string' &&
  entry.realpath === entry.path &&
  /^[0-7]{4}$/.test(entry.mode) &&
  /^\d+:\d+$/.test(entry.owner) &&
  (!hasPhaseLimit || Array.isArray(entry.maxInstancesByPhase)) &&
  digest(entry.sha256);
const signalExitStatus = (signal) => {
  const number = osConstants.signals[signal];
  return Number.isInteger(number) ? 128 + number : 1;
};
const listenerShutdownGraceMilliseconds = 5_000;
// biome-ignore format: compact terminal error preserves the audited runtime cap.
export class ListenerTerminalError extends Error { constructor(exitStatus) { super('listener terminal failure'); this.exitStatus = exitStatus; } }

export function validatePolicyBytes(policyBytes, digestBytes) {
  if (!Buffer.isBuffer(policyBytes) || !Buffer.isBuffer(digestBytes))
    fail('policy bytes refused');
  const expected = digestBytes.toString('utf8');
  if (!/^[0-9a-f]{64}\n$/.test(expected)) fail('policyFileSha256 refused');
  if (sha256(policyBytes) !== expected.slice(0, -1))
    fail('raw policy byte mismatch');
  const policy = parseRunnerPolicy(JSON.parse(policyBytes.toString('utf8')));
  return Object.freeze({
    policy,
    policyCanonicalSha256: canonicalSha256(policy),
    policyFileSha256: expected.slice(0, -1),
  });
}

export const validateCommandSettingsReceipt = (raw, policy) =>
  parseCanonicalCommandSettingsReceipt(raw, policy);

export function parseRuntimeIdentityReceipt(raw, executableSha256) {
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    fail('runtime identity JSON refused');
  }
  if (
    typeof raw !== 'string' ||
    canonicalJson(receipt) !== raw ||
    !exactKeys(receipt, runtimeMapKeys) ||
    receipt.schemaVersion !== 1 ||
    receipt.receiptBinding !== 'image-process-map-v1' ||
    !Array.isArray(receipt.phases) ||
    !receipt.phases.length ||
    !receipt.phases.every((phase) => typeof phase === 'string') ||
    !Array.isArray(receipt.entries) ||
    !Array.isArray(receipt.sealed) ||
    !receipt.entries.every(
      (entry) =>
        typeof entry.role === 'string' &&
        validRuntimeMapMember(entry, runtimeMapEntryKeys, true)
    ) ||
    !receipt.sealed.every((entry) =>
      validRuntimeMapMember(entry, runtimeMapSealedKeys, false)
    )
  )
    fail('runtime identity receipt refused');
  const identity = (role, path) => {
    const entries = receipt.entries.filter(
      (entry) => entry.role === role && entry.path === path
    );
    const sealed = receipt.sealed.filter((entry) => entry.path === path);
    if (
      entries.length !== 1 ||
      sealed.length !== 1 ||
      entries[0].sha256 !== sealed[0].sha256 ||
      (typeof executableSha256 === 'function' &&
        executableSha256(path) !== entries[0].sha256)
    )
      fail('runtime executable identity refused');
    return entries[0].sha256;
  };
  return Object.freeze({
    nodeExecutableSha256: identity('runtimeNode', '/opt/node/bin/node'),
    runnerListenerSha256: identity(
      'listener',
      '/opt/runner/bin/Runner.Listener'
    ),
  });
}

export function registrationArgv(policy, stagingRoot) {
  const defaults = ['self-hosted', 'Linux', 'X64'];
  for (const label of defaults)
    if (policy.runner.labels.filter((value) => value === label).length !== 1)
      fail('default runner labels refused');
  const custom = policy.runner.labels.filter(
    (value) => !defaults.includes(value)
  );
  if (custom.length !== 1 || custom[0] !== 'baci-cwv-measurement')
    fail('custom runner labels refused');
  const executable = join(stagingRoot, 'bin/Runner.Listener');
  return {
    argv: [
      executable,
      'configure',
      '--unattended',
      '--url',
      `https://github.com/${policy.repository.name}`,
      '--name',
      policy.runner.name,
      '--labels',
      custom[0],
      '--work',
      '/runner-work',
      '--disableupdate',
    ],
    executable,
  };
}

export function registrationCommand(policy, stagingRoot, token) {
  if (!Buffer.isBuffer(token) || token.length < 2 || token.at(-1) !== 10)
    fail('registration token refused');
  const tokenText = token.subarray(0, -1).toString('utf8');
  if (
    tokenText.length === 0 ||
    [...tokenText].some((value) => {
      const code = value.codePointAt(0);
      return code < 32 || code === 127;
    })
  )
    fail('registration token refused');
  return {
    ...registrationArgv(policy, stagingRoot),
    env: {
      ACTIONS_RUNNER_INPUT_TOKEN: tokenText,
      HOME: '/home/runner',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PATH: '/opt/node/bin:/usr/bin:/bin',
      TMPDIR: '/tmp/baci-cwv',
    },
  };
}

export async function runRegistrationLifecycle(context, dependencies) {
  let token = Buffer.alloc(0);
  let released = false;
  try {
    dependencies.copyRunnerOnce();
    token = dependencies.readTokenOnce();
    const listener = registrationArgv(context.policy, context.stagingRoot);
    const ready = Object.freeze({
      configureArgvSha256: canonicalSha256(listener.argv),
      generation: 1,
      nodeArgvSha256: context.nodeArgvSha256,
      nodeExecutableSha256: context.nodeExecutableSha256,
      pid: context.pid,
      policyCanonicalSha256: context.policyCanonicalSha256,
      policyFileSha256: context.policyFileSha256,
      registrationNonce: context.registrationNonce,
      schemaVersion: 1,
    });
    const readyBytes = `${canonicalJson(ready)}\n`;
    dependencies.writeReadyOnce(readyBytes);
    await dependencies.waitForTokenAbsence();
    const releaseContext = {
      ...context.releaseBindings,
      configureArgvSha256: ready.configureArgvSha256,
      nodeArgvSha256: ready.nodeArgvSha256,
      nodeExecutableSha256: ready.nodeExecutableSha256,
      pid: ready.pid,
      policyFileSha256: ready.policyFileSha256,
      registrationNonce: ready.registrationNonce,
      registrationReadySha256: sha256(Buffer.from(readyBytes)),
    };
    const releasedReceipt = parseCanonicalRegistrationRelease(
      dependencies.readReleaseOnce(),
      releaseContext,
      dependencies.monotonicMilliseconds(),
      context.policy
    );
    released = true;
    const command = (dependencies.registrationCommand ?? registrationCommand)(
      context.policy,
      context.stagingRoot,
      token
    );
    if (
      command.executable !== command.argv[0] ||
      canonicalSha256(command.argv) !==
        releasedReceipt.release.configureArgvSha256
    )
      fail('registration configure argv drift');
    token.fill(0);
    dependencies.execve(command.executable, command.argv, command.env);
    fail('process.execve returned');
  } finally {
    token.fill(0);
    if (released) dependencies.postReleaseExecFailureCleanup();
    else dependencies.preExecFailureCleanup();
  }
}
export async function runListenerOnce(executable, dependencies = {}) {
  const spawnChild = dependencies.spawn ?? spawn;
  const processObject = dependencies.process ?? process;
  const setTimer = dependencies.setTimeout ?? setTimeout;
  const clearTimer = dependencies.clearTimeout ?? clearTimeout;
  const child = spawnChild(executable, ['run', '--once'], {
    cwd: '/opt/runner',
    env: {
      ACTIONS_RUNNER_HOOK_JOB_STARTED: '/run/baci-cwv-hooks/job-start-hook.sh',
      DISABLE_RUNNER_UPDATE: '1',
      HOME: '/home/runner',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PATH: '/opt/node/bin:/usr/bin:/bin',
      TMPDIR: '/tmp/baci-cwv',
    },
    shell: false,
    stdio: 'inherit',
  });
  let forwarded = false;
  let forcedShutdown = false;
  let graceTimer;
  const forward = (signal) => {
    if (!forwarded) {
      forwarded = true;
      child.kill(signal);
      graceTimer = setTimer(() => {
        forcedShutdown = true;
        child.kill('SIGKILL');
      }, listenerShutdownGraceMilliseconds);
    }
  };
  const interrupt = () => forward('SIGINT');
  const terminate = () => forward('SIGTERM');
  processObject.on('SIGINT', interrupt);
  processObject.on('SIGTERM', terminate);
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    if (forcedShutdown)
      throw new ListenerTerminalError(signalExitStatus('SIGKILL'));
    if (result.signal)
      throw new ListenerTerminalError(signalExitStatus(result.signal));
    if (!Number.isInteger(result.code) || result.code !== 0)
      throw new ListenerTerminalError(result.code ?? 1);
  } finally {
    if (graceTimer !== undefined) clearTimer(graceTimer);
    processObject.off('SIGINT', interrupt);
    processObject.off('SIGTERM', terminate);
  }
}

export async function awaitNormalRelease(context, dependencies) {
  const started = dependencies.monotonicSeconds();
  // biome-ignore format: closed freshness predicate preserves the audited runtime cap.
  if (![started, context.deadline, context.notBefore, context.holdTimeoutSeconds].every(Number.isSafeInteger) || started < context.notBefore || started > context.deadline || context.deadline - started > context.holdTimeoutSeconds || context.deadline - context.notBefore > context.holdTimeoutSeconds) fail('normal release deadline refused');
  while (dependencies.monotonicSeconds() <= context.deadline) {
    const raw = dependencies.readReleaseIfPresent();
    if (raw !== undefined) {
      parseCanonicalNormalRelease(
        raw,
        context.bindings,
        dependencies.monotonicSeconds(),
        context.deadline,
        context.notBefore
      );
      return dependencies.startListenerOnce();
    }
    await dependencies.delay();
  }
  fail('normal listener release timeout');
}
