import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalSha256 } from './canonical-json.mjs';
import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { registrationNetworkAuthority } from './registration-network-authority.fixture.mjs';
import { firewallPolicy, policyRows } from './registration-network-policy.mjs';

const moduleUrl = new URL('./registration-root-network.mjs', import.meta.url);
const identity = {
  forward: 'BCWV-R-BE1C7CAE',
  input: 'BCWV-I-BE1C7CAE',
};
const configuration = Object.freeze({
  context: controllerContext,
  resources: Object.freeze({
    ...resourceContract,
    networkAuthority: registrationNetworkAuthority,
  }),
});
const policy = firewallPolicy({
  ...identity,
  networkAuthority: registrationNetworkAuthority,
});
const readback = (argv) => {
  const chain = argv.at(-1);
  const rules = chain === identity.input ? policy.input : policy.forward;
  return `${policyRows(chain, rules).join('\n')}\n`;
};

test('derives every network command from the sealed campaign contract', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const calls = [];
  const run = (file, argv, options) => {
    calls.push([file, argv, options]);
    if (argv.includes('-S')) return { stderr: '', stdout: readback(argv) };
    if (file === '/usr/sbin/ip')
      return {
        stderr: '',
        stdout: argv.includes('addr')
          ? '7: baci-cwv0    inet 172.31.255.1/28 scope global baci-cwv0\n'
          : argv.includes('eth0')
            ? '2: eth0: <BROADCAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default\n'
            : '7: baci-cwv0: <BROADCAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default\n',
      };
    if (file === '/usr/bin/docker' && argv.includes('network'))
      return {
        stderr: '',
        stdout: argv.includes('create')
          ? `${'f'.repeat(64)}\n`
          : 'baci-cwv-net 172.31.255.0/28 172.31.255.1 baci-cwv0 false\n',
      };
    return { stderr: '', stdout: '' };
  };
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: run,
  });
  await network.createNetwork();
  await network.installIsolation();
  assert.equal(
    calls.every(
      ([file, argv, options]) =>
        file.startsWith('/') &&
        Array.isArray(argv) &&
        !JSON.stringify(argv).includes('/tmp/escape') &&
        Object.keys(options.env).sort().join(',') === 'LC_ALL,PATH,TZ'
    ),
    true
  );
  assert.equal(
    calls.some(
      ([file, argv]) =>
        file === '/usr/sbin/ip' && argv.join(' ') === '-o link show dev eth0'
    ),
    true
  );
  assert.equal(
    calls.some(
      ([file, argv]) =>
        file === '/usr/bin/docker' &&
        argv.includes('--subnet=172.31.255.0/28') &&
        argv.includes('--gateway=172.31.255.1') &&
        argv.includes('baci-cwv-net')
    ),
    true
  );
});

test('returns digests of the normalized default-drop and active read-backs', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const run = (_file, argv) => {
    if (argv.includes('-C') && argv.includes('--dport')) {
      const error = Object.assign(new Error('missing'), { code: 1 });
      throw error;
    }
    if (argv.includes('-L'))
      return {
        stderr: '',
        stdout:
          'Chain BCWV-R-01234567 (1 references)\n pkts bytes target prot opt in out source destination\n 0 0 REJECT all -- baci-cwv0 * 172.31.255.0/28 0.0.0.0/0\n',
      };
    if (argv.includes('-S')) {
      const rules = [
        ...policy.forward.filter(
          (rule) =>
            !policy.probeAllowRules.includes(rule) &&
            rule !== policy.defaultDropRule
        ),
        policy.probeAllowRules.find((rule) => rule.includes('443')),
      ];
      return {
        stderr: '',
        stdout: `${policyRows(identity.forward, rules).join('\n')}\n`,
      };
    }
    return { stderr: '', stdout: '' };
  };
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: run,
  });
  const zero = await network.verifyDefaultDrop();
  const active = await network.activateEgress();
  assert.match(zero.zeroCountersSha256, /^[a-f0-9]{64}$/);
  assert.match(active.activeEgressRuleSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(
    zero.zeroCountersSha256,
    controllerContext.zeroCountersSha256
  );
  assert.notEqual(
    active.activeEgressRuleSha256,
    controllerContext.activeEgressRuleSha256
  );
  assert.equal(
    zero.zeroCountersSha256,
    canonicalSha256({
      counters: [{ bytes: 0, packets: 0 }],
      mode: 'default-drop',
      schemaVersion: 1,
    })
  );
});

test('installs a read-back policy with captured routes, external interface, and terminal bridge reject', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const calls = [];
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: (_file, argv) => {
      calls.push(argv);
      if (argv.includes('-S')) return { stderr: '', stdout: readback(argv) };
      if (argv.includes('eth0'))
        return {
          stderr: '',
          stdout:
            '2: eth0: <BROADCAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default\n',
        };
      return { stderr: '', stdout: '' };
    },
  });
  await network.installIsolation();
  const joined = calls.map((argv) => argv.join(' ')).join('\n');
  assert.match(joined, /-i baci-cwv0 ! -s 172\.31\.255\.0\/28 -j REJECT/);
  for (const range of [
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '169.254.0.0/16',
    '172.18.0.0/16',
  ])
    assert.match(
      joined,
      new RegExp(
        `-d ${range.replaceAll('.', '\\.').replace('/', '\\/')} -j REJECT`
      )
    );
  assert.match(joined, /-o eth0 -p udp --dport 53 -j ACCEPT/);
  assert.match(
    joined,
    /-i eth0 -o baci-cwv0 -d 172\.31\.255\.0\/28 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT/
  );
  assert.match(joined, /-i baci-cwv0 -j REJECT/);
  assert.ok(calls.some((argv) => argv.includes('-S')));
});

test('uses dedicated mocked probes for cross-UID environment denial and direct-IP TLS with DNS answer checks', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const calls = [];
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: (_file, argv) => {
      calls.push(argv);
      if (argv.some((value) => value.includes('cross-uid-environ-denied')))
        return { stderr: '', stdout: 'cross-uid-environ-denied\n' };
      if (argv.some((value) => value.includes('dns-tls-sni-ok')))
        return { stderr: '', stdout: 'dns-tls-sni-ok\n' };
      return { stderr: '', stdout: `${'f'.repeat(64)}\n` };
    },
  });
  await network.probeCrossUid();
  await network.probePublicTls();
  const joined = calls.map((argv) => argv.join(' ')).join('\n');
  assert.match(joined, /test ! -r \/proc\/1\/environ/);
  assert.doesNotMatch(joined, /\/bin\/cat \/proc\/1\/environ/);
  assert.match(joined, /--user=1000:1000/);
  assert.match(joined, /--user=10001:10001/);
  assert.match(joined, /--user=10002:10002/);
  assert.match(joined, /getent ahostsv4/);
  assert.match(joined, /--resolve api\.github\.com:443:/);
  assert.match(joined, /--proto =https/);
});

test('permits only explicit already-absent cleanup and propagates unexpected firewall or network failures', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const error = Object.assign(new Error('permission denied'), { code: 2 });
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: (_file, argv) => {
      if (argv.includes('-D') || argv.includes('rm')) throw error;
      return { stderr: '', stdout: '' };
    },
  });
  await assert.rejects(network.removeIsolation(), /permission denied/);
  await assert.rejects(network.removeNetwork(), /permission denied/);
});

test('fails closed when the policy chain is absent during default-drop transition', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const absent = Object.assign(new Error('not found'), { code: 1 });
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: (_file, argv) => {
      if (argv.includes('-S')) throw absent;
      return { stderr: '', stdout: '' };
    },
  });
  await assert.rejects(
    network.setDefaultDrop(),
    /registration root network refused/
  );
});

test('removes every temporary DNS and TLS allowance before the final bridge drop is relied on', async () => {
  const { createRegistrationNetworkOperations } = await import(moduleUrl);
  const calls = [];
  const network = createRegistrationNetworkOperations(configuration, {
    executeFile: (_file, argv) => {
      calls.push(argv);
      if (argv.includes('-S')) return { stderr: '', stdout: readback(argv) };
      return { stderr: '', stdout: '' };
    },
  });
  await network.setDefaultDrop();
  const deletes = calls
    .filter((argv) => argv.includes('-D'))
    .map((argv) => argv.join(' '));
  assert.equal(deletes.filter((argv) => argv.includes('--dport 53')).length, 2);
  assert.equal(
    deletes.filter((argv) => argv.includes('--dport 443')).length,
    1
  );
  assert.equal(
    calls.some(
      (argv) =>
        argv.join(' ') === `-w -C ${identity.forward} -i baci-cwv0 -j REJECT`
    ),
    true
  );
});
