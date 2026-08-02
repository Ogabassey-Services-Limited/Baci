import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { serializeCommandSettingsReceipt } from './command-settings-contract.mjs';
import {
  registrationCommand,
  runRegistrationLifecycle,
  validateCommandSettingsReceipt,
  validatePolicyBytes,
} from './entrypoint.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { registrationReleaseKeys } from './registration-release.mjs';

const policyBytes = readFileSync(new URL('policy.json', import.meta.url));
const policy = parseRunnerPolicy(JSON.parse(policyBytes));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('tiny Bash wrapper can launch only the normal pinned Node lifecycle', () => {
  const source = readFileSync(
    new URL('entrypoint.sh', import.meta.url),
    'utf8'
  );
  assert.deepEqual(
    source,
    '#!/usr/bin/bash\nset -euo pipefail\n\nif [[ "$#" -ne 0 ]]; then\n  echo \'entrypoint.sh: unexpected arguments\' >&2\n  exit 1\nfi\nexec /opt/node/bin/node /opt/baci-cwv/entrypoint.mjs --mode normal\n'
  );
  assert.doesNotMatch(
    source,
    /registration|token|Runner\.Listener|run\.sh|env\.sh|config\.sh/
  );
});

test('raw policy digest authorizes exact bytes while canonical digest stays separate', () => {
  const raw = sha256(policyBytes);
  const result = validatePolicyBytes(policyBytes, Buffer.from(`${raw}\n`));
  assert.equal(result.policyFileSha256, raw);
  assert.match(result.policyCanonicalSha256, /^[0-9a-f]{64}$/);
  assert.notEqual(result.policyFileSha256, result.policyCanonicalSha256);
  assert.throws(
    () =>
      validatePolicyBytes(
        Buffer.concat([policyBytes, Buffer.from('\n')]),
        Buffer.from(`${raw}\n`)
      ),
    /raw policy byte mismatch/
  );
  assert.throws(
    () => validatePolicyBytes(policyBytes, Buffer.from(`${raw}\nextra\n`)),
    /policyFileSha256/
  );
});

test('registration release timing reads the host boot clock instead of Node uptime', () => {
  const source = readFileSync(
    new URL('normal-release.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /readFileSync\('\/proc\/uptime', 'utf8'\)/);
  assert.doesNotMatch(
    readFileSync(new URL('entrypoint.mjs', import.meta.url), 'utf8'),
    /monotonicMilliseconds: \(\) => Math\.trunc\(performance\.now\(\)\)/
  );
});

test('direct registration command has the frozen configure argv and minimal environment', () => {
  const token = Buffer.from('fixture-registration-token\n');
  const command = registrationCommand(
    policy,
    '/registration-staging/actions-runner',
    token
  );
  assert.deepEqual(command.argv, [
    '/registration-staging/actions-runner/bin/Runner.Listener',
    'configure',
    '--unattended',
    '--url',
    'https://github.com/ogabasseyy/Baci',
    '--name',
    'baci-cwv-measurement-01',
    '--labels',
    'baci-cwv-measurement',
    '--work',
    '/runner-work',
    '--disableupdate',
  ]);
  assert.deepEqual(Object.keys(command.env).sort(), [
    'ACTIONS_RUNNER_INPUT_TOKEN',
    'HOME',
    'LANG',
    'LC_ALL',
    'PATH',
    'TMPDIR',
  ]);
  assert.equal(command.env.TMPDIR, '/tmp/baci-cwv');
  const leaksToken = command.argv.some((argument) =>
    argument.includes('fixture-registration-token')
  );
  assert.equal(leaksToken, false);
});

test('registration requires the canonical pinned CommandSettings secret-input receipt', () => {
  const receipt = {
    commandSettingsSha256: policy.supplyChain.runner.commandSettingsSha256,
    commandSettingsUrl: policy.supplyChain.runner.commandSettingsUrl,
    nodeProcessExecve: true,
    runnerSha256: policy.supplyChain.runner.sha256,
    runnerVersion: policy.supplyChain.runner.version,
    schemaVersion: 1,
    secretInputContract: {
      copiedToArgumentMap: true,
      masked: true,
      removedFromEnvironment: true,
    },
  };
  assert.deepEqual(
    validateCommandSettingsReceipt(
      serializeCommandSettingsReceipt(receipt),
      policy
    ),
    receipt
  );
  const drifted = { ...receipt, nodeProcessExecve: false };
  assert.throws(
    () =>
      validateCommandSettingsReceipt(
        serializeCommandSettingsReceipt(drifted),
        policy
      ),
    /receipt binding/
  );
});

function releaseFromReady(readyBytes, context, now = 1_000) {
  const ready = JSON.parse(readyBytes);
  const values = Object.fromEntries(
    registrationReleaseKeys.map((key) => [
      key,
      key.endsWith('Sha256') ? 'a'.repeat(64) : 'bound',
    ])
  );
  Object.assign(values, {
    ...context.releaseBindings,
    createdMonotonicMilliseconds: now,
    expiresMonotonicMilliseconds: now + 5_000,
    generation: 1,
    ...(values.configureArgvSha256 === undefined
      ? {}
      : { configureArgvSha256: ready.configureArgvSha256 }),
    nodeArgvSha256: ready.nodeArgvSha256 ?? ready.argvSha256,
    nodeExecutableSha256: ready.nodeExecutableSha256,
    pid: ready.pid,
    policyFileSha256: ready.policyFileSha256,
    registrationNonce: ready.registrationNonce,
    registrationReadySha256: 'b'.repeat(64),
    schemaVersion: 1,
  });
  return values;
}

function registrationFixture() {
  const events = [];
  const token = Buffer.from('fixture-registration-token\n');
  const context = {
    nodeExecutableSha256: 'c'.repeat(64),
    nodeArgvSha256: '9'.repeat(64),
    pid: 41,
    policy,
    policyCanonicalSha256: 'd'.repeat(64),
    policyFileSha256: 'e'.repeat(64),
    registrationNonce: 'nonce',
    releaseBindings: {
      campaignId: 'campaign',
      captureSha256: 'f'.repeat(64),
      cgroupNamespace: 'cgroup:[1]',
      containerId: 'container',
      imageDigest: 'sha256:image',
      mountNamespace: 'mnt:[2]',
      tokenAbsenceSha256: '1'.repeat(64),
      tokenDeleteSha256: '2'.repeat(64),
      tokenUnmountSha256: '3'.repeat(64),
      userNamespace: 'user:[3]',
      zeroCountersSha256: '4'.repeat(64),
      activeEgressRuleSha256: '5'.repeat(64),
    },
    stagingRoot: '/registration-staging/actions-runner',
  };
  let readyBytes;
  let tokenReads = 0;
  let releaseReads = 0;
  const dependencies = {
    copyRunnerOnce: () => events.push('copy-runner'),
    execve: (_file, argv, env) => {
      events.push('execve');
      assert.equal(argv[1], 'configure');
      assert.equal(
        env.ACTIONS_RUNNER_INPUT_TOKEN,
        'fixture-registration-token'
      );
      assert.equal(
        token.every((byte) => byte === 0),
        true
      );
      throw new Error('fixture execve');
    },
    monotonicMilliseconds: () => 2_000,
    postReleaseExecFailureCleanup: () => events.push('post-release-cleanup'),
    preExecFailureCleanup: () => events.push('pre-exec-cleanup'),
    readReleaseOnce: () => {
      releaseReads += 1;
      events.push('read-release');
      const release = releaseFromReady(readyBytes, context);
      release.registrationReadySha256 = sha256(Buffer.from(readyBytes));
      return `${canonicalJson(release)}\n`;
    },
    readTokenOnce: () => {
      tokenReads += 1;
      events.push('read-token');
      return token;
    },
    waitForTokenAbsence: async () => events.push('token-enoent'),
    writeReadyOnce: (bytes) => {
      events.push('ready');
      readyBytes = bytes;
    },
  };
  return {
    context,
    dependencies,
    events,
    counts: () => ({ releaseReads, tokenReads }),
    ready: () => JSON.parse(readyBytes),
  };
}

test('registration waits for ENOENT and one release before same-PID execve', async () => {
  const fixture = registrationFixture();
  fixture.dependencies.registrationCommand = (...args) => {
    fixture.events.push('construct-command');
    return registrationCommand(...args);
  };
  await assert.rejects(
    runRegistrationLifecycle(fixture.context, fixture.dependencies),
    /fixture execve/
  );
  assert.deepEqual(fixture.events, [
    'copy-runner',
    'read-token',
    'ready',
    'token-enoent',
    'read-release',
    'construct-command',
    'execve',
    'post-release-cleanup',
  ]);
  assert.deepEqual(fixture.counts(), { releaseReads: 1, tokenReads: 1 });
  assert.equal(fixture.ready().nodeArgvSha256, '9'.repeat(64));
  assert.match(fixture.ready().configureArgvSha256, /^[0-9a-f]{64}$/);
});

test('registration zeroes the token and invokes cleanup before release', async () => {
  const fixture = registrationFixture();
  fixture.dependencies.waitForTokenAbsence = () => {
    throw new Error('token still mounted');
  };
  await assert.rejects(
    runRegistrationLifecycle(fixture.context, fixture.dependencies),
    /token still mounted/
  );
  assert.equal(fixture.events.includes('read-release'), false);
  assert.equal(fixture.events.at(-1), 'pre-exec-cleanup');
});

test('registration refuses an exec target that differs from the released configure argv', async () => {
  const fixture = registrationFixture();
  fixture.dependencies.registrationCommand = (...args) => ({
    ...registrationCommand(...args),
    executable: '/tmp/unbound-listener',
  });
  await assert.rejects(
    runRegistrationLifecycle(fixture.context, fixture.dependencies),
    /configure argv drift/
  );
  assert.equal(fixture.events.includes('execve'), false);
});

test('runtime source never invokes upstream shells or enumerates environment', () => {
  const source = ['entrypoint.mjs', 'entrypoint-runtime.mjs']
    .map((name) => readFileSync(new URL(name, import.meta.url), 'utf8'))
    .join('\n');
  assert.doesNotMatch(
    source,
    /runsvc\.sh|spawnSync|Object\.entries\(process\.env\)|process\.env\)/
  );
  assert.match(source, /process\.execve/);
  assert.match(source, /\['run', '--once'\]/);
});
