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
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import identityContract from './identity-contract.json' with { type: 'json' };
import {
  deriveRunnerIdentity,
  sealRunnerIdentity,
} from './runner-identity-contract.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runner = Object.freeze({
  agentId: 41,
  agentName: 'baci-cwv-measurement-01',
  disableUpdate: true,
  ephemeral: true,
  gitHubUrl: 'https://github.com/ogabasseyy/Baci',
  poolId: 7,
  poolName: 'Default',
  // actions/runner@v2.335.1 RunnerSettings persisted field names.
  serverUrl: 'https://pipelines.actions.githubusercontent.com/runner/opaque',
  serverUrlV2: 'https://pipelines.actions.githubusercontent.com/runner/opaque',
  useV2Flow: true,
  workFolder: '/runner-work',
});
const bytes = (value) => Buffer.from(JSON.stringify(value), 'utf8');
const owner = { gid: process.getgid(), uid: process.getuid() };

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runner-identity-'));
  const staging = path.join(root, 'staging.runner');
  const sealed = path.join(root, 'sealed', 'actions-runner');
  const target = path.join(root, 'sealed', 'runner-identity.json');
  await mkdir(path.dirname(sealed), { recursive: true });
  await writeFile(staging, bytes(runner), { mode: 0o600 });
  await writeFile(sealed, bytes(runner), { mode: 0o440 });
  return { sealed, staging, target };
}

async function seal(paths) {
  return await sealRunnerIdentity({
    identityContract,
    owner,
    runner: owner,
    sealedIdentityPath: paths.target,
    sealedRunnerPath: paths.sealed,
    stagingRunnerPath: paths.staging,
  });
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

test('derives the exact non-secret runner identity projection', () => {
  const receipt = deriveRunnerIdentity(bytes(runner), identityContract);

  assert.deepEqual(Object.keys(receipt).sort(), ['bytes', 'sha256']);
  assert.equal(
    receipt.bytes.toString('utf8'),
    '{"generation":1,"id":41,"name":"baci-cwv-measurement-01"}'
  );
  assert.equal(receipt.sha256, sha256(receipt.bytes));
  assert.doesNotMatch(receipt.bytes.toString('utf8'), /serverUrl|workFolder/);
});

test('refuses runner identity drift and malformed or oversized bytes', () => {
  for (const value of [
    { ...runner, agentId: 0 },
    { ...runner, agentName: 'other-runner' },
    { ...runner, gitHubUrl: 'https://github.com/other/repository' },
    { ...runner, serverUrl: 'https://example.com/runner' },
    {
      ...runner,
      serverUrl: 'http://pipelines.actions.githubusercontent.com/x',
    },
    {
      ...runner,
      serverUrl: 'https://user@pipelines.actions.githubusercontent.com/x',
    },
    {
      ...runner,
      serverUrl: 'https://pipelines.actions.githubusercontent.com/x?q=1',
    },
    { ...runner, workFolder: '_work' },
    { ...runner, disableUpdate: false },
    { ...runner, poolId: 0 },
    { ...runner, poolName: '' },
    { ...runner, useV2Flow: 'true' },
    { ...runner, extra: true },
  ])
    assert.throws(() => deriveRunnerIdentity(bytes(value), identityContract));
  assert.throws(() => deriveRunnerIdentity(Buffer.from('{'), identityContract));
  assert.throws(() =>
    deriveRunnerIdentity(Buffer.alloc(16_385, 0x20), identityContract)
  );
});

test('refuses an incomplete reviewed identity contract', () => {
  const contract = structuredClone(identityContract);
  delete contract.builderSources.github.controllerGeneration;
  assert.throws(() => deriveRunnerIdentity(bytes(runner), contract));
});

test('binds the projection generation to the reviewed controller contract', () => {
  const contract = structuredClone(identityContract);
  contract.builderSources.github.controllerGeneration = 2;
  const receipt = deriveRunnerIdentity(bytes(runner), contract);

  assert.equal(
    receipt.bytes.toString('utf8'),
    '{"generation":2,"id":41,"name":"baci-cwv-measurement-01"}'
  );
});

test('allows only the pinned githubapp ServerUrlV2 hosted family', () => {
  const hosted = deriveRunnerIdentity(
    bytes({
      ...runner,
      serverUrlV2: 'https://pipelines.githubapp.com/runner/opaque',
    }),
    identityContract
  );

  assert.match(hosted.sha256, /^[a-f0-9]{64}$/);
  assert.throws(() =>
    deriveRunnerIdentity(
      bytes({
        ...runner,
        serverUrlV2: 'https://pipelines.githubapp.com.evil.example/runner',
      }),
      identityContract
    )
  );
});

test('seals a stable staging and sealed runner identity as canonical root data', async () => {
  const paths = await fixture();
  const receipt = await seal(paths);
  const output = await readFile(paths.target);

  assert.equal(
    output.toString('utf8'),
    '{"generation":1,"id":41,"name":"baci-cwv-measurement-01"}'
  );
  assert.equal(receipt.runnerIdentitySha256, sha256(output));
});

test('refuses a staging runner that grows during its bounded read', async () => {
  const paths = await fixture();
  const restore = await mutateAfterFirstBoundedRead(paths.staging, async () => {
    await appendFile(paths.staging, ' ');
  });

  try {
    await assert.rejects(seal(paths));
  } finally {
    restore();
  }
});

test('refuses a sealed runner that is truncated during its bounded read', async () => {
  const paths = await fixture();
  const restore = await mutateAfterFirstBoundedRead(paths.sealed, async () => {
    await writeFile(paths.sealed, '{');
  });

  try {
    await assert.rejects(seal(paths));
  } finally {
    restore();
  }
});

test('refuses staging-versus-sealed drift and unsafe identity publication paths', async () => {
  {
    const paths = await fixture();
    await chmod(paths.sealed, 0o600);
    await writeFile(paths.sealed, bytes({ ...runner, agentId: 42 }), {
      mode: 0o600,
    });
    await chmod(paths.sealed, 0o440);
    await assert.rejects(seal(paths));
  }
  {
    const paths = await fixture();
    await chmod(paths.staging, 0o644);
    await assert.rejects(seal(paths));
  }
  {
    const paths = await fixture();
    await link(paths.sealed, `${paths.sealed}.copy`);
    await assert.rejects(seal(paths));
  }
  {
    const paths = await fixture();
    await symlink('/tmp/escape', paths.target);
    await assert.rejects(seal(paths));
  }
});
