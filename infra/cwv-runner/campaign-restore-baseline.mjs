import { spawnSync } from 'node:child_process';

import { verifyStableNetworkSnapshot } from './campaign-network-contract.mjs';

const fail = (message) => {
  throw new Error(message);
};
const COMMAND_TIMEOUT_MS = 30_000;
const COMMAND_MAX_BUFFER = 16 * 1024 * 1024;
const command = (spawn, file, ...args) => {
  const result = spawn(file, args, {
    encoding: 'buffer',
    maxBuffer: COMMAND_MAX_BUFFER,
    timeout: COMMAND_TIMEOUT_MS,
  });
  if (result.error?.code === 'ETIMEDOUT')
    fail(`network snapshot timed out: ${file}`);
  if (result.error?.code === 'ENOBUFS')
    fail(`network snapshot output buffer exhausted: ${file}`);
  if (result.status !== 0) fail(`network snapshot failed: ${file}`);
  return result.stdout;
};
export function verifyBaseline(capture, directory, spawn = spawnSync) {
  const outputs = Object.fromEntries([
    ['iptables', command(spawn, '/usr/sbin/iptables-save')],
    ['ip6tables', command(spawn, '/usr/sbin/ip6tables-save')],
    ['ipRules4', command(spawn, '/usr/sbin/ip', '-json', '-4', 'rule', 'show')],
    ['ipRules6', command(spawn, '/usr/sbin/ip', '-json', '-6', 'rule', 'show')],
    ['addresses', command(spawn, '/usr/sbin/ip', '-json', 'address', 'show')],
    [
      'routes',
      command(spawn, '/usr/sbin/ip', '-json', 'route', 'show', 'table', 'all'),
    ],
  ]);
  const networks = command(spawn, '/usr/bin/docker', 'network', 'ls', '-q')
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort()
    .flatMap((id) =>
      command(spawn, '/usr/bin/docker', 'network', 'inspect', id)
    );
  outputs.dockerNetworks = Buffer.concat(networks);
  const network = capture.priorState.network;
  try {
    const actual = verifyStableNetworkSnapshot(network, outputs);
    return { directory, actual: actual.inventories };
  } catch (error) {
    fail(`complete network baseline mismatch: ${error.message}`);
  }
}
