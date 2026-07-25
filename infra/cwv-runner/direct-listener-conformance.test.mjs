import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  expectedConfigureArgv,
  expectedRunArgv,
  runDirectListenerConformance,
} from './direct-listener-conformance.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const wirePolicy = JSON.parse(
  readFileSync(new URL('policy.json', import.meta.url))
);
const policy = parseRunnerPolicy(wirePolicy);
const writablePaths = [
  '/opt/runner/_diag',
  '/registration-staging',
  '/runner-work',
  '/tmp/baci-cwv',
];
const write = (path, contents, mode = 0o755) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, { mode });
  chmodSync(path, mode);
};

function createFixture() {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'baci-cwv-direct-listener-'))
  );
  const listener = join(root, 'bin/Runner.Listener.mjs');
  const launcher = join(root, 'entrypoint.mjs');
  const report = join(root, 'report.json');
  const configureArgv = [listener, ...expectedConfigureArgv(policy).slice(1)];
  write(
    listener,
    `#!${process.execPath}\nimport { writeFileSync } from 'node:fs';\nconst argv = process.argv.slice(1);\nconst report = { argv, counters: { preReleasePackets: 0, releasedPackets: 1 }, cwd: process.cwd(), environment: Object.keys(process.env).filter((key) => key !== '__CF_USER_TEXT_ENCODING').sort(), pid: process.pid, writablePaths: ${JSON.stringify(writablePaths)} };\nwriteFileSync(${JSON.stringify(report)}, JSON.stringify(report));\nif (argv.includes('--disableupdate') && argv[1] === 'run') process.exit(64);\nif (['SIGINT', 'SIGTERM'].includes(process.env.BACI_CWV_FIXTURE_SIGNAL)) process.kill(process.pid, process.env.BACI_CWV_FIXTURE_SIGNAL);\n`
  );
  write(
    launcher,
    `import { writeFileSync } from 'node:fs';\nconst [listener, failure] = process.argv.slice(2);\ndelete process.env.__CF_USER_TEXT_ENCODING;\nif (failure === 'exec-failure') { writeFileSync(${JSON.stringify(report)}, JSON.stringify({ defaultDropRestored: true, noSurvivingProcess: true, stagingRemoved: true, tokenDeleted: true })); process.exit(23); }\nprocess.execve(process.execPath, [process.execPath, listener, ...${JSON.stringify(configureArgv.slice(1))}], process.env);\n`
  );
  const configureEnvironment = {
    ACTIONS_RUNNER_INPUT_TOKEN: 'throwaway-token',
    HOME: '/home/runner',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PATH: '/opt/node/bin:/usr/bin:/bin',
    TMPDIR: '/tmp/baci-cwv',
  };
  const runEnvironment = {
    DISABLE_RUNNER_UPDATE: '1',
    HOME: '/home/runner',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PATH: '/opt/node/bin:/usr/bin:/bin',
    TMPDIR: '/tmp/baci-cwv',
  };
  return {
    root,
    manifest: {
      cases: [
        {
          argv: [launcher, listener],
          environment: configureEnvironment,
          executable: process.execPath,
          name: 'configure',
          writablePaths: [...writablePaths],
        },
        {
          argv: [launcher, listener, 'exec-failure'],
          environment: configureEnvironment,
          executable: process.execPath,
          expectedExit: 23,
          name: 'configure-exec-failure',
          writablePaths: [...writablePaths],
        },
        {
          argv: ['run', '--once'],
          environment: runEnvironment,
          executable: listener,
          name: 'run',
          writablePaths: [...writablePaths],
        },
        ...[
          ['SIGINT', 130],
          ['SIGTERM', 143],
        ].map(([signal, expectedExit]) => ({
          argv: ['run', '--once'],
          environment: { ...runEnvironment, BACI_CWV_FIXTURE_SIGNAL: signal },
          executable: listener,
          expectedExit,
          name: `run-${signal.toLowerCase()}`,
          writablePaths: [...writablePaths],
        })),
        {
          argv: ['run', '--once', '--disableupdate'],
          environment: runEnvironment,
          executable: listener,
          expectedExit: 64,
          name: 'run-rejects-disableupdate',
          writablePaths: [...writablePaths],
        },
      ],
      cwd: root,
      launcherSources: [{ path: launcher, sha256: sha256(launcher) }],
      listener: {
        path: listener,
        sha256: sha256(listener),
        version: policy.supplyChain.runner.version,
      },
      node: {
        path: process.execPath,
        sha256: sha256(process.execPath),
        version: policy.supplyChain.node.version,
      },
      report,
    },
  };
}

test('executes the complete direct configure/run fixture matrix', async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { force: true, recursive: true }));

  const receipt = await runDirectListenerConformance(fixture.manifest, policy);

  assert.match(receipt.digest, /^[0-9a-f]{64}$/);
  assert.deepEqual(receipt.configure.argv, [
    fixture.manifest.listener.path,
    ...expectedConfigureArgv(policy).slice(1),
  ]);
  assert.deepEqual(receipt.run.argv, expectedRunArgv);
  assert.equal(receipt.configure.pidTransition, true);
  assert.equal(receipt.configure.preReleasePackets, 0);
  assert.equal(receipt.run.releasedPackets, 1);
});

test('refuses the ambient /tmp fallback in every direct-listener mode', async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { force: true, recursive: true }));
  for (const definition of fixture.manifest.cases)
    definition.environment.TMPDIR = '/tmp';
  await assert.rejects(
    runDirectListenerConformance(fixture.manifest, policy),
    /environment refused/
  );
});

test('bounds a hung external conformance child with the policy hook deadline', async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { force: true, recursive: true }));
  const child = new EventEmitter();
  const signals = [];
  const timer = {};
  let scheduled;
  let cleared = 0;
  let spawnOptions;
  child.pid = 42;
  child.kill = (signal) => {
    signals.push(signal);
    queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };

  const pending = runDirectListenerConformance(fixture.manifest, policy, {
    clearTimeout(value) {
      assert.equal(value, timer);
      cleared += 1;
    },
    setTimeout(callback, delay) {
      scheduled = { callback, delay };
      return timer;
    },
    spawn(_executable, _argv, options) {
      spawnOptions = options;
      return child;
    },
  });

  assert.equal(
    scheduled?.delay,
    policy.repositoryAuthority.hookTimeoutSeconds * 1000
  );
  scheduled.callback();
  await assert.rejects(pending, /conformance child timeout: configure/);
  assert.equal(spawnOptions.signal.aborted, true);
  assert.deepEqual(signals, ['SIGKILL']);
  assert.equal(cleared, 1);
  assert.equal(child.listenerCount('error'), 0);
  assert.equal(child.listenerCount('exit'), 0);
});

test('fails closed when a binary, launcher source, or writable path drifts', async (t) => {
  for (const [name, mutate] of [
    [
      'binary',
      (fixture) => writeFileSync(fixture.manifest.listener.path, 'drift'),
    ],
    [
      'launcher',
      (fixture) =>
        writeFileSync(fixture.manifest.launcherSources[0].path, 'drift'),
    ],
    ['version', (fixture) => (fixture.manifest.node.version = '0.0.0')],
    ['path', (fixture) => fixture.manifest.cases[0].writablePaths.push('/etc')],
  ]) {
    const fixture = createFixture();
    t.after(() => rmSync(fixture.root, { force: true, recursive: true }));
    mutate(fixture);
    await assert.rejects(
      () => runDirectListenerConformance(fixture.manifest, policy),
      /conformance/,
      name
    );
  }
});

test('runs the fixture matrix through its closed manifest CLI', (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { force: true, recursive: true }));
  const manifest = join(fixture.root, 'manifest.json');
  writeFileSync(manifest, JSON.stringify(fixture.manifest));

  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('direct-listener-conformance.mjs', import.meta.url)
      ),
      '--manifest',
      manifest,
      '--policy',
      fileURLToPath(new URL('policy.json', import.meta.url)),
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).digest, /^[0-9a-f]{64}$/);
});

test('CLI rejects a self-consistent drifted policy and manifest', (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { force: true, recursive: true }));
  const manifest = join(fixture.root, 'manifest.json');
  const policyPath = join(fixture.root, 'policy.json');
  const driftedPolicy = structuredClone(wirePolicy);
  driftedPolicy.supplyChain.runner.version = '0.0.0';
  fixture.manifest.listener.version = '0.0.0';
  writeFileSync(manifest, JSON.stringify(fixture.manifest));
  writeFileSync(policyPath, JSON.stringify(driftedPolicy));

  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('direct-listener-conformance.mjs', import.meta.url)
      ),
      '--manifest',
      manifest,
      '--policy',
      policyPath,
    ],
    { encoding: 'utf8' }
  );

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /direct listener conformance refused/);
});
