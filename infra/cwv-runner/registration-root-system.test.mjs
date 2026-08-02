import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  observedAuthority,
  resourceContract,
} from './controller-contract.fixture.mjs';

const moduleUrl = new URL('./registration-root-system.mjs', import.meta.url);
const configuration = {
  context: controllerContext,
  resources: resourceContract,
};

test('executes only the fixed host lifecycle and delegates bounded network receipts', async () => {
  const { createRegistrationSystemOperations } = await import(moduleUrl);
  const calls = [];
  const egressReleaseSha256 = 'c'.repeat(64);
  const network = Object.fromEntries(
    [
      'activateEgress',
      'createNetwork',
      'installIsolation',
      'probeCrossUid',
      'probeIsolation',
      'probePublicTls',
      'removeIsolation',
      'removeNetwork',
      'removeProbeAllow',
      'setDefaultDrop',
      'verifyDefaultDrop',
    ].map((name) => [
      name,
      () => {
        calls.push(['network', name]);
        if (name === 'activateEgress')
          return {
            activeEgressRuleSha256: 'a'.repeat(64),
          };
        if (name === 'verifyDefaultDrop')
          return { zeroCountersSha256: controllerContext.zeroCountersSha256 };
        return {};
      },
    ])
  );
  const run = (file, argv, options) => {
    calls.push(['exec', file, argv, options]);
    if (argv.includes('image') && argv.includes('inspect'))
      return { stderr: '', stdout: `${controllerContext.imageDigest}\n` };
    if (file.endsWith('campaign-quiesce.sh'))
      return { stderr: '', stdout: `${controllerContext.captureSha256}\n` };
    if (argv.includes('wait')) return { stderr: '', stdout: '0\n' };
    if (argv.includes('inspect')) return { stderr: '', stdout: '' };
    return { stderr: '', stdout: '' };
  };
  const system = createRegistrationSystemOperations(configuration, {
    executeFile: run,
    files: {
      paths: {
        handoff: '/fixed/handoff',
        sealedRunner: '/fixed/sealed',
        staging: '/fixed/staging',
        token: '/fixed/token',
        tokenParent: '/fixed/token-parent',
      },
    },
    network,
    receipts: {
      validateOutput: async () => ({}),
      waitReady: async () => ({
        registrationReadySha256: controllerContext.registrationReadySha256,
      }),
      waitReleaseReadOnce: async () => ({ reads: 1, sha256: 'a'.repeat(64) }),
    },
    sealer: {
      sealRunner: async () => ({ sealedRunnerSha256: 'b'.repeat(64) }),
    },
    readRegistrationCommand: async () => Buffer.from('{"schemaVersion":2}'),
    recordJournalEntry: async () => ({ sha256: egressReleaseSha256 }),
    publishRegistrationRetryBlock: (value) => {
      calls.push(['retry-block', value]);
      return value;
    },
    verifyPreparedTransaction: async () => ({ schemaVersion: 1 }),
    verifyAuthority: async (authority) =>
      assert.deepEqual(authority, observedAuthority),
    verifyPath: async () => undefined,
  });
  await system('verify-prepared-transaction', {
    campaignId: controllerContext.campaignId,
  });
  await system('verify-retained-image', {
    campaignId: controllerContext.campaignId,
  });
  await system('create-network', { campaignId: controllerContext.campaignId });
  await system('activate-registration-egress', {});
  await system('mark-registration-ambiguous', {
    cleanupSha256: 'd'.repeat(64),
    egressReleaseSha256,
  });
  assert.deepEqual(
    await system('verify-default-drop', {
      campaignId: controllerContext.campaignId,
    }),
    { zeroCountersSha256: controllerContext.zeroCountersSha256 }
  );
  assert.deepEqual(await system('seal-runner', {}), {
    sealedRunnerSha256: 'b'.repeat(64),
  });
  assert.equal(
    calls.filter(
      ([kind, , , options]) =>
        kind !== 'exec' ||
        Object.keys(options.env).sort().join(',') === 'LC_ALL,PATH,TZ'
    ).length,
    calls.length
  );
  assert.deepEqual(
    calls.find(([kind]) => kind === 'retry-block'),
    [
      'retry-block',
      {
        campaignId: controllerContext.campaignId,
        cleanupSha256: 'd'.repeat(64),
        commandSha256:
          'bafebd36189ad3688b7b3915ea55d461e0bfcfbdde11e54b0a123999fb6be50f',
        disposition: 'owner-row-deletion-required',
        egressReleaseSha256,
        schemaVersion: 1,
      },
    ]
  );
});

test('guards the sealed authority and refuses generic command/path/env operations', async () => {
  const { createRegistrationSystemOperations } = await import(moduleUrl);
  let guarded = false;
  const system = createRegistrationSystemOperations(configuration, {
    executeFile: async () => ({ stderr: '', stdout: '' }),
    files: { paths: {} },
    network: {},
    receipts: {},
    sealer: {},
    verifyAuthority: () => {
      guarded = true;
    },
    verifyPath: async () => undefined,
  });
  await system('guard-registration', {
    authority: observedAuthority,
    boundary: 'registration-ready',
  });
  assert.equal(guarded, true);
  for (const [operation, context] of [
    ['execute', { command: '/bin/sh' }],
    ['mount-token', { path: '/tmp/escape' }],
    ['start-daemons', { env: { PATH: '/tmp' } }],
  ])
    await assert.rejects(
      system(operation, context),
      /registration root (?:operation|system) refused/
    );
});

test('removes the token in the guarded container mount and PID namespaces before host cleanup', async () => {
  const { createRegistrationSystemOperations } = await import(moduleUrl);
  const calls = [];
  const system = createRegistrationSystemOperations(configuration, {
    executeFile: (file, argv) => {
      calls.push([file, argv]);
      if (argv.includes('/usr/bin/findmnt') && argv.includes('--json'))
        return { stderr: '', stdout: '{"filesystems":[]}\n' };
      if (
        argv.includes('/usr/bin/findmnt') &&
        argv.includes('--target') &&
        argv.includes('/run/secrets/runner-registration-token')
      )
        throw new Error('target absent');
      if (file === '/usr/bin/findmnt') return { stderr: '', stdout: 'tmpfs\n' };
      return { stderr: '', stdout: '' };
    },
    files: { paths: { tokenParent: '/fixed/token-parent' } },
    guard: async () => ({
      guardReceiptSha256: 'a'.repeat(64),
      guardSequence: 1,
    }),
    lstat: async () => ({ isDirectory: () => true }),
    network: {},
    receipts: {},
    sealer: {},
    verifyAuthority: async () => undefined,
  });
  await system('guard-registration', {
    authority: observedAuthority,
    boundary: 'registration-ready',
  });
  await system('unmount-token');
  const nsenter = calls.find(
    ([file, argv]) =>
      file === '/usr/bin/nsenter' && argv.includes('/usr/bin/umount')
  );
  assert.deepEqual(nsenter, [
    '/usr/bin/nsenter',
    [
      '--target',
      '4312',
      '--mount',
      '--pid',
      '--',
      '/usr/bin/umount',
      '--',
      '/run/secrets/runner-registration-token',
    ],
  ]);
  assert.ok(
    calls.findIndex(
      ([file, argv]) =>
        file === '/usr/bin/umount' && argv.at(-1) === '/fixed/token-parent'
    ) > calls.indexOf(nsenter)
  );
});

test('fails closed when watchdog state cannot be read and accepts only a synchronously inactive watchdog', async () => {
  const { createRegistrationSystemOperations } = await import(moduleUrl);
  const options = {
    files: { paths: {} },
    network: {},
    receipts: {},
    sealer: {},
    verifyAuthority: async () => undefined,
  };
  const broken = createRegistrationSystemOperations(configuration, {
    ...options,
    executeFile: () => Promise.reject(new Error('transport failure')),
  });
  await assert.rejects(
    broken('disarm-watchdog', {}),
    /registration root system refused/
  );
  const absent = createRegistrationSystemOperations(configuration, {
    ...options,
    executeFile: async () => ({
      stderr: '',
      stdout:
        'UnitFileState=disabled\nActiveState=inactive\nLoadState=not-found\n',
    }),
  });
  await assert.doesNotReject(absent('disarm-watchdog', {}));

  const calls = [];
  let reads = 0;
  const normal = createRegistrationSystemOperations(configuration, {
    ...options,
    executeFile: (file, argv) => {
      calls.push([file, argv]);
      if (argv[0] === 'show') {
        reads += 1;
        return {
          stderr: '',
          stdout:
            reads === 1
              ? 'ActiveState=active\nUnitFileState=enabled\nLoadState=loaded\n'
              : 'UnitFileState=disabled\nLoadState=loaded\nActiveState=inactive\n',
        };
      }
      return { stderr: '', stdout: '' };
    },
  });
  await assert.doesNotReject(normal('disarm-watchdog', {}));
  assert.deepEqual(calls[0], [
    '/bin/systemctl',
    [
      'disable',
      '--now',
      `baci-cwv-campaign-watchdog@${controllerContext.campaignId}.service`,
    ],
  ]);
  assert.ok(reads >= 2);
});
