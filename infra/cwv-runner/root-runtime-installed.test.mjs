import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { canonicalJson } from './campaign-state.mjs';
import {
  controllerContext,
  observedAuthority,
  registrationExecutor,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  registrationContainerArgv,
  registrationLayout,
} from './registration-controller.mjs';
import { runInstalledRootRuntimeController } from './root-runtime-executor.mjs';
import { registrationOperationNames } from './root-runtime-operations.mjs';
import { runtimeIdentityProbeArgv } from './runtime-probe-controller.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const operationJson = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `[${value.map(operationJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${operationJson(value[key])}`)
    .join(',')}}`;
};

function sourceEnvelope(source, value) {
  const canonical = canonicalJson(value);
  return {
    canonical,
    owner: { gid: 10001, mode: '0640', uid: 0 },
    schemaVersion: 1,
    sha256Receipt: `${sha256(canonical)}\n`,
    source,
  };
}

function runtimeEnvelope() {
  const runner = {
    files: [
      { path: 'bin/Runner.Listener', sha256: '1'.repeat(64) },
      { path: 'bin/Runner.Worker', sha256: '2'.repeat(64) },
      { path: 'entrypoint.mjs', sha256: '3'.repeat(64) },
    ],
    version: '2.335.1',
  };
  return sourceEnvelope('runtime', {
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
    runtimeRunner: runner,
    runtimeRunnerBinaryDigest: sha256(canonicalJson(runner)),
    schemaVersion: 1,
  });
}

function imageEnvelope(runtime) {
  return sourceEnvelope('image', {
    id: controllerContext.imageDigest,
    imageReceiptSha256: '9'.repeat(64),
    platform: 'linux/amd64',
    runtimeIdentitySha256: sha256(runtime.canonical),
    runtimeManifestSha256: 'e'.repeat(64),
    schemaVersion: 1,
  });
}

const absent = (containerId) => ({
  bridgeAbsent: true,
  captureRestored: true,
  cgroupAbsent: true,
  containerId,
  containerdInactive: true,
  containers: [],
  dockerInactive: true,
  dockerSocketAbsent: true,
  firewallAbsent: true,
  networkAbsent: true,
  processAbsent: true,
  releaseArtifacts: [],
  schemaVersion: 2,
  stagingArtifacts: [],
  tokenArtifacts: [],
});
const incompleteTerminal = async () => ({
  registrationComplete: false,
  runnerIdentitySha256: null,
});

function fixturePayload(operation, context, layout, secret) {
  if (operation === 'create-token-layout')
    return { tokenParent: layout.tokenParent };
  if (operation === 'write-registration-token')
    if (!Buffer.isBuffer(secret)) throw new TypeError('missing binary token');
    else
      return {
        bytes: secret,
        token: layout.token,
      };
  if (operation === 'create-staging-layout') return { staging: layout.staging };
  if (operation === 'create-release-layout')
    return { handoff: layout.handoff, releaseParent: layout.releaseParent };
  if (
    ['mount-policy', 'mount-staging', 'mount-token', 'mount-release'].includes(
      operation
    )
  )
    return { layout };
  if (operation === 'create-registration-container')
    return {
      argv: registrationContainerArgv(controllerContext, resourceContract),
    };
  if (operation === 'publish-release-once')
    return {
      bytes: context.bytes,
      gid: 10001,
      mode: 0o440,
      path: `${layout.handoff.path}/release.json`,
      sha256: context.sha256,
      uid: 0,
    };
  if (operation === 'verify-release-file')
    return {
      gid: 10001,
      mode: 0o440,
      path: `${layout.handoff.path}/release.json`,
      sha256: context.sha256,
      uid: 0,
    };
  return context;
}

test('installed registration command uses only the frozen operation inventory and stdin token handoff', async () => {
  const layout = registrationLayout(controllerContext);
  const fixture = registrationExecutor(layout);
  const requests = [];
  const secrets = [];
  const events = [];
  const result = await runInstalledRootRuntimeController(
    ['register-token-stdin'],
    {
      executeBackend: async (request, transport) => {
        requests.push(request);
        const { context, operation, schemaVersion } = JSON.parse(request);
        assert.equal(schemaVersion, 1);
        assert.ok(registrationOperationNames.includes(operation));
        const secret = transport?.secret;
        if (secret !== undefined) secrets.push(secret);
        const payload = fixturePayload(operation, context, layout, secret);
        const value = await fixture.dependencies.execute(operation, payload);
        if (['remove-isolation', 'remove-network'].includes(operation))
          return `${operationJson({ schemaVersion: 1, status: 'removed' })}\n`;
        if (operation === 'stop-daemons')
          return `${operationJson({ containerd: 'stopped', docker: 'stopped', schemaVersion: 1 })}\n`;
        if (operation === 'restore-capture')
          return `${operationJson({ capture: 'restored', schemaVersion: 1 })}\n`;
        if (operation === 'remove-registration-container')
          return `${operationJson({ containerId: observedAuthority.containerId, removed: true, schemaVersion: 1 })}\n`;
        if (operation === 'prove-registration-cleanup')
          return `${operationJson(absent(observedAuthority.containerId))}\n`;
        return `${operationJson(value)}\n`;
      },
      executeFile: () => {
        throw new Error('registration must not execute Docker directly');
      },
      readConfiguration: () => {
        events.push('read-configuration');
        return { context: controllerContext, resources: resourceContract };
      },
      prepareRegistrationCommand: (mode) => {
        events.push(`prepare:${mode}`);
      },
      publishRegistrationTerminalReceipt: (receipt) => {
        events.push('terminal:publish');
        assert.match(receipt.runnerIdentitySha256, /^[a-f0-9]{64}$/);
      },
      readPostEgressRelease: async () => undefined,
      readRegistrationTerminalState: incompleteTerminal,
      readStdin: () => {
        assert.equal(fixture.calls.includes('probe-public-tls'), true);
        return Buffer.from(`${'A'.repeat(29)}\n`);
      },
    }
  );
  assert.deepEqual(events.slice(0, 2), ['read-configuration', 'prepare:begin']);
  assert.deepEqual(events.slice(-2), ['terminal:publish', 'prepare:finalize']);
  assert.equal(result.imageDigest, controllerContext.imageDigest);
  assert.equal(fixture.calls.includes('read-token'), false);
  assert.equal(
    requests.filter(
      (request) =>
        JSON.parse(request).operation === 'create-registration-container'
    ).length,
    1
  );
  assert.ok(requests.length > registrationOperationNames.length);
  assert.equal(
    requests.some((request) => request.includes('A'.repeat(29))),
    false
  );
  assert.equal(secrets.length, 1);
  assert.equal(
    secrets[0].every((byte) => byte === 0),
    true
  );
});

test('refuses registration before attaching stdin when preparation fails', async () => {
  let stdinRead = false;
  await assert.rejects(
    runInstalledRootRuntimeController(['register-token-stdin'], {
      prepareRegistrationCommand: () => {
        throw new Error('capture incomplete');
      },
      readPostEgressRelease: async () => undefined,
      readRegistrationTerminalState: incompleteTerminal,
      readConfiguration: () => {
        return { context: controllerContext, resources: resourceContract };
      },
      readStdin: () => {
        stdinRead = true;
        return Buffer.alloc(0);
      },
    }),
    /capture incomplete/
  );
  assert.equal(stdinRead, false);
});

test('installed runtime command uses fixed Docker argv then persists accepted runtime and host evidence', async () => {
  const calls = [];
  const evidence = [];
  const runtime = runtimeEnvelope();
  const image = imageEnvelope(runtime);
  const result = await runInstalledRootRuntimeController(
    ['probe-runtime-identity'],
    {
      buildStableAttestation: async () => ({ sha256: 'f'.repeat(64) }),
      executeFile: (file, argv) => {
        calls.push([file, argv]);
        return { stdout: `${canonicalJson(runtime)}\n` };
      },
      publishEvidence: (root, source, envelope) => {
        evidence.push([root, source, envelope]);
        return {
          path: `${root}/${source}.json`,
          sha256: envelope.sha256Receipt.slice(0, -1),
        };
      },
      readConfiguration: async () => ({
        context: controllerContext,
        resources: resourceContract,
      }),
      readHostEnvelope: async () => sourceEnvelope('host', { sample: 'host' }),
      readImageEnvelope: async () => image,
    }
  );
  assert.deepEqual(calls, [
    [
      '/usr/bin/docker',
      runtimeIdentityProbeArgv(controllerContext, resourceContract).slice(1),
    ],
  ]);
  assert.deepEqual(
    evidence.map(([, source]) => source),
    ['runtime', 'host', 'image']
  );
  assert.equal(result.attestation.sha256, 'f'.repeat(64));
  assert.equal(result.envelope.source, 'runtime');
});
