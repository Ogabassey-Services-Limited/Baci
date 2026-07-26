import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { canonicalJson as canonical } from './campaign-state.mjs';
import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  containsRuntimeCredential,
  isolationProbeArgv,
  runIsolationProbe,
  runRuntimeIdentityProbe,
  runtimeIdentityProbeArgv,
  validateIsolationProbeArgv,
  validateRuntimeIdentityProbeArgv,
} from './runtime-probe-controller.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('isolation probe uses network none and production resource flags only', () => {
  const argv = isolationProbeArgv(controllerContext, resourceContract);
  for (const value of [
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges=true',
    '--cgroup-parent=cwv-measurement.slice',
    '--cpuset-cpus=2-3',
    '--memory=8589934592b',
    '--memory-swap=8589934592b',
    '--pids-limit=1024',
    '--shm-size=1073741824',
    '--entrypoint=/opt/baci-cwv/isolation-probe.sh',
    `--name=baci-cwv-isolation-${controllerContext.campaignId}`,
  ])
    assert.ok(argv.includes(value), value);
  assert.doesNotMatch(
    argv.join('\n'),
    /Runner\.Listener|token|credential|\.runner/i
  );
  assert.deepEqual(
    validateIsolationProbeArgv(argv, controllerContext, resourceContract),
    argv
  );
  assert.throws(
    () =>
      validateIsolationProbeArgv(
        argv.map((value) =>
          value === '--network=none' ? '--network=bridge' : value
        ),
        controllerContext,
        resourceContract
      ),
    /isolation probe argv refused/
  );
});

test('isolation probe accepts only the complete Boolean receipt', async () => {
  const receipt = {
    cgroup: true,
    cpuset: true,
    gid: true,
    readOnlyRoot: true,
    resources: true,
    shm: true,
    uid: true,
  };
  const result = await runIsolationProbe(
    controllerContext,
    resourceContract,
    () => `${JSON.stringify(receipt)}\n`
  );
  assert.equal(result.campaignId, controllerContext.campaignId);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(
    runIsolationProbe(controllerContext, resourceContract, () =>
      JSON.stringify({ ...receipt, uid: false })
    ),
    /isolation probe refused/
  );
});

test('runtime identity uses the dedicated socket, isolated credential-free Docker projection', () => {
  const argv = runtimeIdentityProbeArgv(controllerContext, resourceContract);
  for (const value of [
    `--host=${resourceContract.dockerSocket}`,
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges=true',
    '--memory-swap=8589934592b',
    '--volume=/srv/baci-cwv/sealed/runtime-runner-binaries:/opt/runner:ro',
    '--entrypoint=/opt/node/bin/node',
    controllerContext.imageDigest,
    '/opt/baci-cwv/container-attest-runtime.mjs',
    '/',
  ])
    assert.ok(argv.includes(value), value);
  assert.deepEqual(argv.slice(-4), [
    controllerContext.imageDigest,
    '/opt/baci-cwv/container-attest-runtime.mjs',
    '/',
    controllerContext.imageDigest,
  ]);
  assert.doesNotMatch(
    argv.join('\n'),
    /credential|(?:^|[/=])\.runner(?:$|[/=])|\.env|token/i
  );
  assert.deepEqual(
    validateRuntimeIdentityProbeArgv(argv, controllerContext, resourceContract),
    argv
  );
  assert.throws(
    () =>
      validateRuntimeIdentityProbeArgv(
        ['/bin/sh'],
        controllerContext,
        resourceContract
      ),
    /runtime identity argv refused/
  );
});

test('runtime identity returns only canonical credentials-free JSON and digest', async () => {
  const runtime = {
    chrome: {
      binarySha256: 'a'.repeat(64),
      debianPackage: {
        architecture: 'amd64',
        name: 'google-chrome-stable',
        version: '150.0.7871.128-1',
      },
      debianSha256:
        '83ed59c85878ebb8fa53915ebe7066cafc58d1c04c1c95449486e6f9d99a1efb',
      version: '150.0.7871.128',
    },
    imageId: controllerContext.imageDigest,
    node: { binarySha256: 'b'.repeat(64), version: '24.18.0' },
    pnpm: {
      binarySha256: 'c'.repeat(64),
      packageJsonSha256: 'd'.repeat(64),
      packageProjection: {
        bin: 'bin/pnpm.cjs',
        name: 'pnpm',
        version: '11.7.0',
      },
      version: '11.7.0',
    },
    runtimeRunner: {
      files: [
        { path: 'bin/Runner.Listener', sha256: '1'.repeat(64) },
        { path: 'bin/Runner.Worker', sha256: '2'.repeat(64) },
        { path: 'entrypoint.mjs', sha256: '3'.repeat(64) },
      ],
      version: '2.335.1',
    },
    runtimeRunnerBinaryDigest: 'e'.repeat(64),
    schemaVersion: 1,
  };
  runtime.runtimeRunnerBinaryDigest = sha256(canonical(runtime.runtimeRunner));
  assert.equal(containsRuntimeCredential(runtime), false);
  assert.equal(
    containsRuntimeCredential({
      ...runtime,
      observation: { note: 'bearer otherwise-valid-placeholder' },
    }),
    true
  );
  const runtimeBytes = canonical(runtime);
  const envelope = {
    canonical: runtimeBytes,
    owner: { gid: 10001, mode: '0640', uid: 0 },
    schemaVersion: 1,
    sha256Receipt: `${sha256(runtimeBytes)}\n`,
    source: 'runtime',
  };
  const result = await runRuntimeIdentityProbe(
    controllerContext,
    resourceContract,
    (argv) => {
      assert.deepEqual(
        argv,
        runtimeIdentityProbeArgv(controllerContext, resourceContract)
      );
      return `${canonical(envelope)}\n`;
    }
  );
  assert.deepEqual(result, {
    canonical: runtimeBytes,
    envelope,
    sha256: sha256(runtimeBytes),
  });

  const invalidRuntime = { ...runtime, imageId: 'latest' };
  const invalidRuntimeBytes = canonical(invalidRuntime);
  const invalidEnvelope = {
    ...envelope,
    canonical: invalidRuntimeBytes,
    sha256Receipt: `${sha256(invalidRuntimeBytes)}\n`,
  };
  await assert.rejects(
    runRuntimeIdentityProbe(
      controllerContext,
      resourceContract,
      () => `${canonical(invalidEnvelope)}\n`
    ),
    /runtime identity refused/
  );

  for (const invalid of [
    { ...runtime, node: { ...runtime.node, version: '' } },
    {
      ...runtime,
      chrome: {
        ...runtime.chrome,
        debianPackage: {
          ...runtime.chrome.debianPackage,
          architecture: 'arm64',
        },
      },
    },
    {
      ...runtime,
      pnpm: {
        ...runtime.pnpm,
        packageProjection: {
          ...runtime.pnpm.packageProjection,
          bin: 'bin/other.cjs',
        },
      },
    },
    { ...runtime, runtimeRunner: { ...runtime.runtimeRunner, files: [] } },
    {
      ...runtime,
      runtimeRunner: {
        ...runtime.runtimeRunner,
        version: 'Bearer ordinary-value',
      },
    },
    ...[
      'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
      'ghs_abcdefghijklmnopqrstuvwxyz1234567890',
      'github_pat_abcdefghijklmnopqrstuvwxyz1234567890',
      'cfat_abcdefghijklmnopqrstuvwxyz1234567890',
    ].map((version) => ({
      ...runtime,
      runtimeRunner: { ...runtime.runtimeRunner, version },
    })),
    { ...runtime, node: { ...runtime.node, signingKey: 'ordinary' } },
  ]) {
    const canonicalBytes = canonical(invalid);
    const unsafe = {
      ...envelope,
      canonical: canonicalBytes,
      sha256Receipt: `${sha256(canonicalBytes)}\n`,
    };
    await assert.rejects(
      runRuntimeIdentityProbe(
        controllerContext,
        resourceContract,
        () => `${canonical(unsafe)}\n`
      ),
      /runtime identity refused/
    );
  }
});
