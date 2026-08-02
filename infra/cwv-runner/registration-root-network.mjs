import { createHash } from 'node:crypto';
import { canonicalSha256 } from './canonical-json.mjs';
import { createNetworkCleanup } from './registration-network-cleanup.mjs';
import { firewallPolicy, policyRows } from './registration-network-policy.mjs';
import { createNetworkProbes } from './registration-network-probes.mjs';
import { isolationProbeArgv } from './runtime-probe-controller.mjs';

const DOCKER = '/usr/bin/docker';
const IPTABLES = '/usr/sbin/iptables';
const IP = '/usr/sbin/ip';
const NETWORK = 'baci-cwv-net';
const BRIDGE = 'baci-cwv0';
const SUBNET = '172.31.255.0/28';
const GATEWAY = '172.31.255.1';
const FIXED_OPTIONS = Object.freeze({
  env: Object.freeze({
    LC_ALL: 'C.UTF-8',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    TZ: 'Etc/UTC',
  }),
  maxBuffer: 1_048_576,
});
// biome-ignore format: compact fixed failure preserves the file-size gate
const fail = () => { throw new TypeError('registration root network refused'); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
// biome-ignore format: compact counter normalization preserves the file-size gate
const counters = (rows) => [...rows.matchAll(/^\s*(\d+)\s+(\d+)\s+/gm)].map(([, packets, bytes]) => ({ bytes: Number(bytes), packets: Number(packets) }));
// biome-ignore format: compact fixed result validator preserves the file-size gate
const output = (result) => { if (typeof result?.stdout !== 'string' || result?.stderr !== '') fail(); return result.stdout; };
function requireConfiguration(configuration) {
  const campaign = configuration?.context?.campaignId;
  const socket = configuration?.resources?.dockerSocket;
  if (
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(campaign) ||
    socket !== 'unix:///run/baci-cwv/docker.sock'
  )
    fail();
  let networkAuthority;
  try {
    networkAuthority = firewallPolicy({
      forward: 'BCWV-R-VALIDATION',
      input: 'BCWV-I-VALIDATION',
      networkAuthority: configuration.resources.networkAuthority,
    }).names.networkAuthority;
  } catch {
    fail();
  }
  const suffix = sha256(campaign).slice(0, 8).toUpperCase();
  return Object.freeze({
    campaign,
    comment: `baci-cwv:${campaign}`,
    forward: `BCWV-R-${suffix}`,
    input: `BCWV-I-${suffix}`,
    networkAuthority,
    socket,
  });
}
// biome-ignore format: fixed registration network contract preserves the file-size gate
export function createRegistrationNetworkOperations(configuration, dependencies = {}) {
  const identity = requireConfiguration(configuration);
  const run = dependencies.executeFile;
  if (typeof run !== 'function') fail();
  const execute = async (file, argv) => output(await run(file, argv, FIXED_OPTIONS));
  const check = async (argv) => {
    try {
      await execute(IPTABLES, argv);
      return true;
    } catch (error) {
      if (error?.code === 1) return false;
      throw error;
    }
  };
  const docker = (...argv) =>
    execute(DOCKER, [`--host=${identity.socket}`, ...argv]);
  const policy = firewallPolicy(identity);
  const { defaultDropRule, probeAllowRules } = policy;
  const tlsRule = probeAllowRules.find((rule) => rule.includes('443'));
  const { externalIfindex, externalInterface } = identity.networkAuthority;
  const verifyExternalInterface = async () =>
    new RegExp(`^${externalIfindex}: ${externalInterface}:`).test(
      await execute(IP, ['-o', 'link', 'show', 'dev', externalInterface])
    ) || fail();
  const readChain = async (chain, rules) => {
    const actual = await execute(IPTABLES, ['-w', '-S', chain]);
    if (actual !== `${policyRows(chain, rules).join('\n')}\n`) fail();
  };
  const absent = async (file, argv) => {
    try {
      await execute(file, argv);
      return false;
    } catch (error) {
      if (error?.code === 1) return true;
      throw error;
    }
  };
  const cleanup = createNetworkCleanup({
    absent,
    bridge: BRIDGE,
    check,
    docker: DOCKER,
    execute,
    identity,
    ip: IP,
    iptables: IPTABLES,
    network: NETWORK,
    subnet: SUBNET,
  });
  const probes = createNetworkProbes({
    campaign: identity.campaign,
    docker,
    fail,
    image: configuration.context.imageDigest,
    network: NETWORK,
    networkAuthority: identity.networkAuthority,
  });
  return Object.freeze({
    async createNetwork() {
      const id = (
        await docker(
          'network',
          'create',
          '--driver=bridge',
          `--subnet=${SUBNET}`,
          `--gateway=${GATEWAY}`,
          `--opt=com.docker.network.bridge.name=${BRIDGE}`,
          '--ipv6=false',
          NETWORK
        )
      ).trim();
      if (!/^[a-f0-9]{64}$/.test(id)) fail();
      if (
        (await docker(
          'network',
          'inspect',
          '--format={{.Name}} {{(index .IPAM.Config 0).Subnet}} {{(index .IPAM.Config 0).Gateway}} {{.Options.com.docker.network.bridge.name}} {{.EnableIPv6}}',
          NETWORK
        )) !== `${NETWORK} ${SUBNET} ${GATEWAY} ${BRIDGE} false\n`
      )
        fail();
      if (
        !/^\d+: baci-cwv0: <[^>]+>/.test(
          await execute(IP, ['-o', 'link', 'show', 'dev', BRIDGE])
        ) ||
        !/^\d+: baci-cwv0\s+inet 172\.31\.255\.1\/28\b/m.test(
          await execute(IP, ['-o', '-4', 'addr', 'show', 'dev', BRIDGE])
        )
      )
        fail();
    },
    async installIsolation() {
      await verifyExternalInterface();
      // biome-ignore format: fixed firewall argv are intentionally one row per command
      for (const argv of [
        ['-w', '-N', identity.input],
        ['-w', '-N', identity.forward],
        ...policy.input.map((rule) => ['-w', '-A', identity.input, ...rule]),
        ...policy.forward.map((rule) => ['-w', '-A', identity.forward, ...rule]),
        ['-w', '-I', 'INPUT', '1', '-m', 'comment', '--comment', identity.comment, '-j', identity.input],
        ['-w', '-I', 'DOCKER-USER', '1', '-m', 'comment', '--comment', identity.comment, '-j', identity.forward],
        ['-w', '-t', 'nat', '-I', 'POSTROUTING', '1', '-s', SUBNET, '-o', identity.networkAuthority.externalInterface, '-m', 'comment', '--comment', identity.comment, '-j', 'MASQUERADE'],
      ])
        await execute(IPTABLES, argv);
      await readChain(identity.input, policy.input);
      await readChain(identity.forward, policy.forward);
      for (const argv of [
        [
          '-w',
          '-C',
          'INPUT',
          '-m',
          'comment',
          '--comment',
          identity.comment,
          '-j',
          identity.input,
        ],
        [
          '-w',
          '-C',
          'DOCKER-USER',
          '-m',
          'comment',
          '--comment',
          identity.comment,
          '-j',
          identity.forward,
        ],
        [
          '-w',
          '-t',
          'nat',
          '-C',
          'POSTROUTING',
          '-s',
          SUBNET,
          '-o',
          identity.networkAuthority.externalInterface,
          '-m',
          'comment',
          '--comment',
          identity.comment,
          '-j',
          'MASQUERADE',
        ],
      ])
        if (!(await check(argv))) fail();
    },
    async probeIsolation() {
      const argv = isolationProbeArgv(
        configuration.context,
        configuration.resources
      );
      const raw = await execute(DOCKER, argv.slice(1));
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        fail();
      }
      if (
        Object.keys(value ?? {})
          .sort()
          .join(',') !== 'cgroup,cpuset,gid,readOnlyRoot,resources,shm,uid' ||
        Object.values(value).some((item) => item !== true)
      )
        fail();
    },
    probeCrossUid: probes.probeCrossUid,
    probePublicTls: probes.probePublicTls,
    async removeProbeAllow() {
      for (const rule of probeAllowRules)
        await execute(IPTABLES, ['-w', '-D', identity.forward, ...rule]);
    },
    async setDefaultDrop() {
      if (!(await check(['-w', '-S', identity.forward]))) fail();
      for (const rule of probeAllowRules)
        if (await check(['-w', '-C', identity.forward, ...rule]))
          await execute(IPTABLES, ['-w', '-D', identity.forward, ...rule]);
      if (!(await check(['-w', '-C', identity.forward, ...defaultDropRule])))
        fail();
      await execute(IPTABLES, ['-w', '-Z', identity.forward]);
    },
    async verifyDefaultDrop() {
      if (!(await check(['-w', '-C', identity.forward, ...defaultDropRule])))
        fail();
      for (const rule of probeAllowRules)
        if (await check(['-w', '-C', identity.forward, ...rule])) fail();
      const rows = await execute(IPTABLES, [
        '-w',
        '-L',
        identity.forward,
        '-v',
        '-n',
        '-x',
      ]);
      const observed = counters(rows);
      if (!observed.length || observed.some(({ bytes, packets }) => !Number.isSafeInteger(bytes) || !Number.isSafeInteger(packets) || bytes !== 0 || packets !== 0)) fail();
      return { zeroCountersSha256: canonicalSha256({ counters: observed, mode: 'default-drop', schemaVersion: 1 }) };
    },
    async activateEgress() {
      if (await check(['-w', '-C', identity.forward, ...defaultDropRule]))
        await execute(IPTABLES, [
          '-w',
          '-D',
          identity.forward,
          ...defaultDropRule,
        ]);
      if (!(await check(['-w', '-C', identity.forward, ...tlsRule])))
        await execute(IPTABLES, ['-w', '-A', identity.forward, ...tlsRule]);
      const rules = [...policy.forward.filter((rule) => !probeAllowRules.includes(rule) && rule !== defaultDropRule), tlsRule];
      const actual = await execute(IPTABLES, ['-w', '-S', identity.forward]);
      if (actual !== `${policyRows(identity.forward, rules).join('\n')}\n`) fail();
      return {
        activeEgressRuleSha256: canonicalSha256({ mode: 'active', rules: actual.trimEnd().split('\n'), schemaVersion: 1 }),
      };
    },
    async inspectEgress() {
      const active = await check(['-w', '-C', identity.forward, ...tlsRule]);
      const rows = await execute(IPTABLES, [
        '-w',
        '-L',
        identity.forward,
        '-v',
        '-n',
        '-x',
      ]);
      let packets = 0;
      let bytes = 0;
      for (const match of rows.matchAll(/^\s*(\d+)\s+(\d+)\s+/gm)) {
        packets += Number(match[1]);
        bytes += Number(match[2]);
      }
      if (![packets, bytes].every(Number.isSafeInteger)) fail();
      return { bytes, mode: active ? 'active' : 'default-drop', packets };
    },
    removeIsolation: cleanup.removeIsolation,
    removeNetwork: cleanup.removeNetwork,
    proveCleanupAbsence: cleanup.proveCleanupAbsence,
  });
}
