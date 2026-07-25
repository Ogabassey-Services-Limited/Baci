import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFile,
  chmod,
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { controllerContext } from './controller-contract.fixture.mjs';

const moduleUrl = new URL('./registration-root-sealing.mjs', import.meta.url);
const identity = { gid: process.getgid(), uid: process.getuid() };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runtimeFiles = [
  ['bin/Runner.Common.dll', 'common\n', 0o444],
  ['bin/Runner.Listener', 'listener\n', 0o555],
  ['bin/Runner.PluginHost', 'plugin\n', 0o555],
  ['bin/Runner.Worker', 'worker\n', 0o555],
  ['entrypoint.mjs', 'entrypoint\n', 0o444],
  ['externals/node24/bin/node', 'node\n', 0o555],
  ['externals/node24/lib/libnode.so', 'library\n', 0o444],
];
const runtimeManifest = Object.freeze({
  files: runtimeFiles.map(([filePath, bytes, mode]) => ({
    mode: mode.toString(8).padStart(4, '0'),
    path: filePath,
    sha256: sha256(bytes),
  })),
  imageId: controllerContext.imageDigest,
  receiptBinding: 'runner-runtime-closure-v1',
  schemaVersion: 1,
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'registration-seal-'));
  const staging = path.join(root, 'staging');
  const sealedRunner = path.join(root, 'sealed', 'actions-runner');
  const sealedIdentity = path.join(root, 'sealed', 'runner-identity.json');
  const runner = path.join(staging, 'actions-runner');
  await mkdir(runner, { recursive: true });
  await mkdir(sealedRunner, { recursive: true });
  for (const [relative, bytes, mode] of runtimeFiles) {
    const target = path.join(runner, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode });
  }
  for (const [relative, bytes] of [
    [
      '.runner',
      '{"agentId":41,"agentName":"baci-cwv-measurement-01","disableUpdate":true,"ephemeral":true,"gitHubUrl":"https://github.com/ogabasseyy/Baci","poolId":7,"poolName":"Default","serverUrl":"https://pipelines.actions.githubusercontent.com/runner/opaque","serverUrlV2":"https://pipelines.actions.githubusercontent.com/runner/opaque","useV2Flow":true,"workFolder":"/runner-work"}\n',
    ],
    ['.credentials', '{"scheme":"OAuth","data":"digest-only"}\n'],
    ['.credentials_rsaparams', '{"d":"digest-only"}\n'],
  ])
    await writeFile(path.join(runner, relative), bytes, { mode: 0o600 });
  const { createRegistrationSealer } = await import(moduleUrl);
  return {
    runner,
    sealedIdentity,
    sealedRunner,
    sealer: createRegistrationSealer(
      { context: controllerContext },
      {
        owner: identity,
        paths: { sealedRunner, staging },
        runner: identity,
        runtimeManifest,
      }
    ),
  };
}

async function mutateAfterFirstBoundedRead(path, mutate) {
  const handle = await open(path, 'r');
  const prototype = Object.getPrototypeOf(handle);
  await handle.close();
  const original = prototype.read;
  let mutated = false;
  prototype.read = async function (...arguments_) {
    const result = await original.apply(this, arguments_);
    if (!mutated) {
      mutated = true;
      await mutate();
    }
    return result;
  };
  return () => {
    prototype.read = original;
  };
}

test('seals the manifest-bound runtime closure plus exact generated identity files', async () => {
  const { sealedIdentity, sealedRunner, sealer } = await fixture();

  const receipt = await sealer.sealRunner();

  assert.match(receipt.sealedRunnerSha256, /^[a-f0-9]{64}$/);
  assert.match(receipt.runnerIdentitySha256, /^[a-f0-9]{64}$/);
  const identityBytes = await readFile(sealedIdentity);
  assert.equal(
    identityBytes.toString('utf8'),
    '{"generation":1,"id":41,"name":"baci-cwv-measurement-01"}'
  );
  assert.equal(receipt.runnerIdentitySha256, sha256(identityBytes));
  assert.equal((await stat(sealedIdentity)).mode & 0o777, 0o400);
  for (const relative of [
    '.credentials',
    '.credentials_rsaparams',
    '.runner',
    'bin/Runner.Common.dll',
    'bin/Runner.Listener',
    'bin/Runner.PluginHost',
    'bin/Runner.Worker',
    'entrypoint.mjs',
    'externals/node24/bin/node',
    'externals/node24/lib/libnode.so',
  ])
    assert.equal(
      (await stat(path.join(sealedRunner, relative))).isFile(),
      true
    );
  for (const relative of [
    'bin/Runner.Listener',
    'bin/Runner.PluginHost',
    'bin/Runner.Worker',
    'externals/node24/bin/node',
  ])
    assert.equal(
      (await stat(path.join(sealedRunner, relative))).mode & 0o777,
      0o550,
      relative
    );
  assert.equal(
    (await stat(path.join(sealedRunner, 'bin/Runner.Common.dll'))).mode & 0o777,
    0o440
  );
});

test('refuses a preexisting or partial runner identity publication', async () => {
  for (const contents of ['partial', '{"generation":1}']) {
    const { sealedIdentity, sealer } = await fixture();
    await writeFile(sealedIdentity, contents, { mode: 0o400 });
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  }
});

test('refuses unreviewed, mutable, and forbidden runner entries', async () => {
  for (const relative of [
    '.env',
    '_diag/diagnostic.json',
    'diagnostics/output',
    'config.sh',
    'env.sh',
    'run.sh',
    'run-helper.sh',
    'safe_sleep.sh',
    'svc.sh',
    'unknown',
  ]) {
    const { runner, sealer } = await fixture();
    const target = path.join(runner, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'unreviewed\n', { mode: 0o600 });
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  }
});

test('refuses manifest drift, symbolic links, hard links, and unsafe metadata', async () => {
  {
    const { runner, sealer } = await fixture();
    const target = path.join(runner, 'bin/Runner.Common.dll');
    await chmod(target, 0o644);
    await writeFile(target, 'drift\n');
    await chmod(target, 0o444);
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  }
  {
    const { runner, sealer } = await fixture();
    await symlink('/tmp/escape', path.join(runner, 'unknown'));
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  }
  {
    const { runner, sealer } = await fixture();
    await link(
      path.join(runner, 'bin/Runner.Listener'),
      path.join(runner, 'bin/Runner.Listener-copy')
    );
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  }
  {
    const { runner, sealer } = await fixture();
    await chmod(path.join(runner, '.credentials'), 0o622);
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  }
});

test('does not expose generated credential bytes in its receipt', async () => {
  const { sealedRunner, sealer } = await fixture();
  const receipt = await sealer.sealRunner();
  assert.deepEqual(Object.keys(receipt).sort(), [
    'runnerIdentitySha256',
    'sealedRunnerSha256',
  ]);
  assert.doesNotMatch(JSON.stringify(receipt), /credential|OAuth|digest-only/);
  assert.match(
    await readFile(path.join(sealedRunner, '.credentials'), 'utf8'),
    /OAuth/
  );
});

test('refuses a runtime file that grows during the bounded sealing copy', async () => {
  const { runner, sealer } = await fixture();
  const source = path.join(runner, 'bin/Runner.Common.dll');
  const restore = await mutateAfterFirstBoundedRead(source, async () => {
    await appendFile(source, 'growth\n');
  });

  try {
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  } finally {
    restore();
  }
});

test('refuses a runtime file that is truncated during the bounded sealing copy', async () => {
  const { runner, sealer } = await fixture();
  const source = path.join(runner, 'bin/Runner.Common.dll');
  const restore = await mutateAfterFirstBoundedRead(source, async () => {
    await writeFile(source, 'short\n');
  });

  try {
    await assert.rejects(sealer.sealRunner(), /registration sealing refused/);
  } finally {
    restore();
  }
});
