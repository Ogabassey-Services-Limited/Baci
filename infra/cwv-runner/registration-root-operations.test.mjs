import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  controllerContext,
  registrationSnapshot,
  resourceContract,
} from './controller-contract.fixture.mjs';
import {
  registrationContainerArgv,
  registrationLayout,
} from './registration-controller.mjs';

const moduleUrl = new URL(
  './registration-root-operations.mjs',
  import.meta.url
);
const configuration = {
  context: controllerContext,
  resources: resourceContract,
};

test('runs the bounded registration lifecycle with derived paths and fixed argv', async () => {
  const { createRegistrationRootBackend } = await import(moduleUrl);
  const calls = [];
  const files = {
    createReleaseLayout: () => calls.push(['files', 'create-release-layout']),
    createStagingLayout: () => calls.push(['files', 'create-staging-layout']),
    createTokenLayout: () => calls.push(['files', 'create-token-layout']),
    deleteReleaseFile: () => calls.push(['files', 'delete-release-file']),
    publishRelease: (bytes, sha256) =>
      calls.push(['files', 'publish-release', bytes, sha256]),
    writeToken: (bytes) => calls.push(['files', 'write-token', bytes]),
  };
  const executeFile = (file, argv) => {
    calls.push(['exec', file, argv]);
    if (argv.includes('create'))
      return { stdout: `${'a'.repeat(64)}\n`, stderr: '' };
    return { stdout: '', stderr: '' };
  };
  const backend = createRegistrationRootBackend(configuration, {
    executeFile,
    files,
    inspect: (phase) =>
      registrationSnapshot(phase, registrationLayout(controllerContext)),
    monotonicMilliseconds: () => 1000,
    journal: {
      containerCreated: () => undefined,
      releaseCreated: () => undefined,
      releaseLayoutCreated: () => undefined,
      stagingCreated: () => undefined,
      tokenCreated: () => undefined,
      tokenLayoutCreated: () => undefined,
    },
    readTokenFd: () => Buffer.from(`${'A'.repeat(29)}\n`),
  });
  await backend('create-token-layout', {});
  await backend('write-registration-token', {});
  await backend('create-staging-layout', {});
  await backend('create-release-layout', {});
  const created = await backend('create-registration-container', {});
  assert.deepEqual(created, { containerId: 'a'.repeat(64) });
  assert.deepEqual(
    calls.find(
      ([kind, file, argv]) =>
        kind === 'exec' && file === '/usr/bin/docker' && argv.includes('create')
    ),
    [
      'exec',
      '/usr/bin/docker',
      registrationContainerArgv(controllerContext, resourceContract).slice(1),
    ]
  );
  assert.equal(
    calls.some((call) => JSON.stringify(call).includes('/tmp/escape')),
    false
  );
  const writtenToken = calls.find((call) => call[1] === 'write-token')[2];
  assert.equal(
    writtenToken.every((byte) => byte === 0),
    true
  );
  assert.deepEqual(await backend('monotonic-milliseconds', {}), {
    value: 1000,
  });
  assert.equal(
    (await backend('inspect-registration', { phase: 'pre-start' }))
      .schemaVersion,
    1
  );
});

test('durably journals every crash-recoverable registration resource before returning', async () => {
  const { createRegistrationRootBackend } = await import(moduleUrl);
  const calls = [];
  const files = {
    createReleaseLayout: () => undefined,
    createStagingLayout: () => undefined,
    createTokenLayout: () => undefined,
    publishRelease: () => undefined,
    paths: {
      handoff:
        '/run/baci-cwv-registration-release/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/handoff',
      releaseParent:
        '/run/baci-cwv-registration-release/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      release:
        '/run/baci-cwv-registration-release/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/handoff/release.json',
      staging:
        '/srv/baci-cwv/registration-staging/cccccccccccccccccccccccccccccccc',
      token:
        '/run/baci-cwv-registration/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/token',
      tokenParent:
        '/run/baci-cwv-registration/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    writeToken: (bytes) => bytes.fill(0),
  };
  const backend = createRegistrationRootBackend(configuration, {
    captureTerminalReceipt: async (action) => ({ action, exact: true }),
    executeFile: (_file, argv) => ({
      stderr: '',
      stdout: argv.includes('create') ? `${'a'.repeat(64)}\n` : '',
    }),
    files,
    recordJournalEntry: ({ action, resource, transactionId }) => {
      assert.equal(transactionId, controllerContext.campaignId);
      calls.push([action, resource]);
    },
    readTokenFd: () => Buffer.from(`${'A'.repeat(29)}\n`),
    system: async () => ({}),
  });

  await backend('create-token-layout', {});
  await backend('write-registration-token', {});
  await backend('create-staging-layout', {});
  await backend('create-release-layout', {});
  await backend('publish-release-once', {
    bytes: '{}\n',
    sha256: createHash('sha256').update('{}\n').digest('hex'),
  });
  await backend('create-registration-container', {});

  assert.deepEqual(calls, [
    [
      'registration-token-layout-created',
      { action: 'registration-token-layout-created', exact: true },
    ],
    [
      'registration-token-created',
      { action: 'registration-token-created', exact: true },
    ],
    [
      'registration-staging-created',
      { action: 'registration-staging-created', exact: true },
    ],
    [
      'registration-release-layout-created',
      { action: 'registration-release-layout-created', exact: true },
    ],
    [
      'registration-release-created',
      { action: 'registration-release-created', exact: true },
    ],
    [
      'registration-container-created',
      {
        containerId: 'a'.repeat(64),
        imageDigest: controllerContext.imageDigest,
        name: `baci-cwv-registration-${controllerContext.registrationNonce}`,
        schemaVersion: 1,
        transactionId: controllerContext.campaignId,
      },
    ],
  ]);
});

test('never forwards caller-selected command, path, environment, or phase', async () => {
  const { createRegistrationRootBackend } = await import(moduleUrl);
  const backend = createRegistrationRootBackend(configuration, {
    executeFile: () => {
      throw new Error('must not execute');
    },
    files: {},
    inspect: () => ({}),
    monotonicMilliseconds: () => 0,
    journal: {
      containerCreated: () => undefined,
      releaseCreated: () => undefined,
      releaseLayoutCreated: () => undefined,
      stagingCreated: () => undefined,
      tokenCreated: () => undefined,
      tokenLayoutCreated: () => undefined,
    },
  });
  for (const [operation, context] of [
    ['create-registration-container', { argv: ['/bin/sh'] }],
    ['create-token-layout', { path: '/tmp/escape' }],
    ['mount-token', { environment: { TOKEN: 'secret' } }],
    ['inspect-registration', { phase: 'assigned' }],
  ])
    await assert.rejects(
      backend(operation, context),
      /registration root operation refused/
    );
});

test('CLI emits exactly one canonical line and never echoes rejected input', async () => {
  const { runRegistrationRootCli } = await import(moduleUrl);
  const writes = { error: '', output: '' };
  const request = Buffer.from(
    '{"context":{},"operation":"monotonic-milliseconds","schemaVersion":1}\n'
  );
  const code = await runRegistrationRootCli(['--execute'], {
    executeRequest: (bytes) => {
      assert.deepEqual(bytes, request);
      return { value: 123 };
    },
    readInput: async () => request,
    stderr: { write: (value) => (writes.error += value) },
    stdout: { write: (value) => (writes.output += value) },
  });
  assert.equal(code, 0);
  assert.equal(writes.error, '');
  assert.equal(writes.output, '{"value":123}\n');

  const token = 'NEVER_ECHO_THIS_TOKEN';
  const refused = { error: '', output: '' };
  assert.equal(
    await runRegistrationRootCli(['--execute', token], {
      readInput: async () => Buffer.from(token),
      stderr: { write: (value) => (refused.error += value) },
      stdout: { write: (value) => (refused.output += value) },
    }),
    65
  );
  assert.equal(refused.output, '');
  assert.equal(refused.error, 'registration root operation refused\n');
  assert.equal(refused.error.includes(token), false);
});

test('server keeps one root backend for every canonical request in the transaction stream', async () => {
  const { runRegistrationRootServer } = await import(
    new URL('./registration-root-request-stream.mjs', import.meta.url)
  );
  const input = new PassThrough();
  const output = [];
  let created = 0;
  const pending = runRegistrationRootServer(['--execute'], {
    createBackend: () => {
      created += 1;
      return async (operation) => ({ operation });
    },
    readConfiguration: async () => configuration,
    stderr: { write: () => undefined },
    stdin: input,
    stdout: { write: (value) => output.push(value) },
  });
  input.end(
    '{"context":{},"operation":"monotonic-milliseconds","schemaVersion":1}\n' +
      '{"context":{},"operation":"unmount-token","schemaVersion":1}\n'
  );
  assert.equal(await pending, 0);
  assert.equal(created, 1);
  assert.deepEqual(output, [
    '{"operation":"monotonic-milliseconds"}\n',
    '{"operation":"unmount-token"}\n',
  ]);
});
