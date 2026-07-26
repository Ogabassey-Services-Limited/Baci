import assert from 'node:assert/strict';
import test from 'node:test';

import { createNetworkCleanup } from './registration-network-cleanup.mjs';

const comment = 'baci-cwv:campaign-001';
const subnet = '172.31.255.0/28';
const identity = Object.freeze({
  comment,
  forward: 'BCWV-R-CAMPAIGN',
  input: 'BCWV-I-CAMPAIGN',
  networkAuthority: Object.freeze({ externalInterface: 'eth0' }),
  socket: 'unix:///run/baci-cwv/docker.sock',
});
const natCheck = Object.freeze([
  '-w',
  '-t',
  'nat',
  '-C',
  'POSTROUTING',
  '-s',
  subnet,
  '-o',
  'eth0',
  '-m',
  'comment',
  '--comment',
  comment,
  '-j',
  'MASQUERADE',
]);
const natDelete = Object.freeze(
  natCheck.map((value) => (value === '-C' ? '-D' : value))
);

function cleanup({ check, execute }) {
  return createNetworkCleanup({
    absent: async () => true,
    bridge: 'baci-cwv0',
    check,
    docker: '/usr/bin/docker',
    execute,
    identity,
    ip: '/usr/sbin/ip',
    iptables: '/usr/sbin/iptables',
    network: 'baci-cwv-net',
    subnet,
  });
}

test('checks and deletes the exact MASQUERADE rule bound to the sealed external interface', async () => {
  let present = true;
  const checked = [];
  const executed = [];
  const network = cleanup({
    check: (argv) => {
      checked.push(argv);
      if (argv.includes('-S')) return false;
      return present && JSON.stringify(argv) === JSON.stringify(natCheck);
    },
    execute: (_file, argv) => {
      executed.push(argv);
      if (argv.includes('-S') && argv.includes('POSTROUTING')) return '';
      if (JSON.stringify(argv) === JSON.stringify(natDelete)) present = false;
      return '';
    },
  });

  assert.deepEqual(await network.removeIsolation(), {
    schemaVersion: 1,
    status: 'removed',
  });
  assert.ok(
    checked.some((argv) => JSON.stringify(argv) === JSON.stringify(natCheck))
  );
  assert.ok(
    executed.some((argv) => JSON.stringify(argv) === JSON.stringify(natDelete))
  );
});

test('rejects a tagged MASQUERADE rule whose external interface drifted', async () => {
  for (const method of ['removeIsolation', 'proveCleanupAbsence']) {
    const network = cleanup({
      check: async () => false,
      execute: async (_file, argv) =>
        argv.includes('-S') && argv.includes('POSTROUTING')
          ? `-A POSTROUTING -s ${subnet} -o eth1 -m comment --comment "${comment}" -j MASQUERADE\n`
          : '',
    });

    await assert.rejects(
      network[method](),
      /registration root network refused/
    );
  }
});
