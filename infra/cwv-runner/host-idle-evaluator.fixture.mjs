import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { processAuthority } from './host-idle-process-authority.fixture.mjs';

import {
  normalRunnerBinds,
  normalRunnerMounts,
  normalRunnerTmpfs,
} from './measurement-container-projection.mjs';

const campaignId = 'campaign-001';
const mark = 2_952_790_017;
const ids = [
  'forwarded-ingress',
  'measurement-ingress',
  'host-local-ingress',
  'forwarded-egress',
  'measurement-egress',
  'host-originated-egress',
];
const accounting = {
  classifyChain: 'classify',
  classifyHook: 'forward',
  classifyPriority: -150,
  ingressChain: 'external_ingress',
  ingressHook: 'forward',
  hostIngressChain: 'host_external_ingress',
  hostIngressHook: 'input',
  egressChain: 'external_egress',
  hostEgressChain: 'host_external_egress',
  egressHook: 'postrouting',
  counterPriority: 0,
};
const resources = {
  measurementCpuSet: '2-3',
  otherCpuSet: '0-1',
  memoryBytes: 8_589_934_592,
  memorySwapBytes: 0,
  pidsLimit: 1024,
  shmBytes: 1_073_741_824,
};
export const thresholds = {
  load1Max: 0.5,
  cpuPsiFullAvg10Max: 0,
  ioPsiFullAvg10Max: 0.1,
  memoryPsiFullAvg10Max: 0,
  cpuStealPercentMax: 0.5,
  availableMemoryBytesMin: 100,
  rootFreeBytesMin: 100,
  networkRxBytesPerSecondMax: 100,
  networkTxBytesPerSecondMax: 100,
  networkSampleSeconds: 10,
  commandTimeoutSeconds: 10,
};
const match = (left, right, op = '==') => ({ match: { left, op, right } });
const meta = (key) => ({ meta: { key } });
const ct = (key) => ({ ct: { key } });
const counter = { counter: { bytes: 1, packets: 1 } };

function nft(base, rehearsal = false) {
  const chains = [
    [
      accounting.classifyChain,
      accounting.classifyHook,
      accounting.classifyPriority,
    ],
    [accounting.ingressChain, accounting.ingressHook, 0],
    [accounting.hostIngressChain, accounting.hostIngressHook, 0],
    [accounting.egressChain, accounting.egressHook, 0],
    [accounting.hostEgressChain, accounting.egressHook, 0],
  ];
  const rules = [
    [
      'classify-measurement',
      accounting.classifyChain,
      [
        match(meta('iifname'), 'veth-runner'),
        match(meta('oifname'), 'eth0'),
        { mangle: { key: ct('mark'), value: mark } },
      ],
    ],
    [
      'forwarded-ingress',
      accounting.ingressChain,
      [
        match(meta('iifname'), 'eth0'),
        match({ fib: { result: 'type', flags: ['daddr'] } }, 'local', '!='),
        counter,
      ],
    ],
    [
      'measurement-ingress',
      accounting.ingressChain,
      [
        match(meta('iifname'), 'eth0'),
        match(meta('oifname'), 'veth-runner'),
        match(ct('mark'), mark),
        counter,
      ],
    ],
    [
      'host-local-ingress',
      accounting.hostIngressChain,
      [match(meta('iifname'), 'eth0'), counter],
    ],
    [
      'forwarded-egress',
      accounting.egressChain,
      [match(meta('oifname'), 'eth0'), match(meta('iif'), 0, '!='), counter],
    ],
    [
      'measurement-egress',
      accounting.egressChain,
      [
        match(meta('oifname'), 'eth0'),
        match(meta('iif'), 0, '!='),
        match(ct('mark'), mark),
        counter,
      ],
    ],
    [
      'host-originated-egress',
      accounting.hostEgressChain,
      [match(meta('oifname'), 'eth0'), match(meta('iif'), 0), counter],
    ],
  ].filter(
    ([id]) =>
      !rehearsal ||
      ![
        'classify-measurement',
        'measurement-ingress',
        'measurement-egress',
      ].includes(id)
  );
  return {
    nftables: [
      { table: { family: 'inet', name: 'baci_cwv_measurement', handle: 1 } },
      ...chains.map(([name, hook, prio], index) => ({
        chain: {
          family: 'inet',
          table: 'baci_cwv_measurement',
          name,
          type: 'filter',
          hook,
          prio,
          policy: 'accept',
          handle: index + 2,
        },
      })),
      ...rules.map(([id, chain, expr]) => ({
        rule: {
          family: 'inet',
          table: 'baci_cwv_measurement',
          chain,
          comment: `baci-cwv:${campaignId}:${id}`,
          handle: id === 'classify-measurement' ? 99 : ids.indexOf(id) + 10,
          expr: expr.map((item) =>
            item.counter
              ? { counter: { bytes: base + ids.indexOf(id), packets: 1 } }
              : item
          ),
        },
      })),
    ],
  };
}

export async function fixture({ mode = 'live' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-idle-evaluator-'));
  const live = mode === 'live';
  await Promise.all(
    ['start', 'end'].map((name) => mkdir(path.join(root, name)))
  );
  const identity = {
    schemaVersion: 1,
    family: 'inet',
    table: 'baci_cwv_measurement',
    tableHandle: 1,
    chainHandles: Object.fromEntries([
      [accounting.classifyChain, 2],
      [accounting.ingressChain, 3],
      [accounting.hostIngressChain, 4],
      [accounting.egressChain, 5],
      [accounting.hostEgressChain, 6],
    ]),
    campaignMark: mark,
    externalInterface: 'eth0',
    runnerInterface: mode === 'live' ? 'veth-runner' : null,
    readyForSampling: mode === 'live',
    handles: Object.fromEntries(
      ids
        .map((id, index) => [id, index + 10])
        .concat([['classify-measurement', 99]])
    ),
  };
  const projection = [
    live ? 'a'.repeat(64) : 'b'.repeat(64),
    `sha256:${'c'.repeat(64)}`,
    true,
    42,
    live ? 'baci-cwv-net' : 'none',
    'cwv-measurement.slice',
    '2-3',
    resources.memoryBytes,
    resources.memoryBytes,
    1024,
    resources.shmBytes,
    true,
    false,
    null,
    ['ALL'],
    ['no-new-privileges=true'],
    live ? [...normalRunnerBinds] : null,
    live ? normalRunnerMounts : [],
    {
      ...(live
        ? normalRunnerTmpfs
        : {
            '/home/runner': 'rw,noexec,nosuid,nodev,size=16777216,mode=700',
            '/tmp': 'rw,noexec,nosuid,nodev,size=16777216,mode=1777',
          }),
    },
    live ? { 'baci-cwv-net': { IPAddress: '172.31.0.2' } } : {},
  ];
  const sample = (base, time) => ({
    stat: `cpu  ${base} 0 ${base} ${base} 0 0 0 0 0 0\ncpu0 ${base} 0 ${base} ${base} 0 0 0 0 0 0\n`,
    monotonic: `${time}\n`,
    'monotonic-end': `${time + 1}\n`,
    loadavg: '0.25 0.00 0.00 1/1 1\n',
    cpu: 'some avg10=0.00 avg60=0.00 avg300=0.00 total=0\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n',
    io: 'some avg10=0.00 avg60=0.00 avg300=0.00 total=0\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n',
    memory:
      'some avg10=0.00 avg60=0.00 avg300=0.00 total=0\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n',
    meminfo: 'MemAvailable:       1024 kB\n',
    rootfs: '100 4096\n',
    nft: JSON.stringify(nft(base, !live)),
    conntrack: `ipv4 2 tcp 6 src=172.31.0.2 dst=1.1.1.1 src=1.1.1.1 dst=172.31.0.2 mark=${mark}\n`,
    cgroup:
      'ActiveState=active\nSubState=active\nControlGroup=/cwv-measurement.slice\nCPUAccounting=yes\nMemoryAccounting=yes\nIOAccounting=yes\n',
    'cgroup.events': 'populated 0\nfrozen 0\n',
    ip_forward: '1\n',
    runner: JSON.stringify(projection),
    interfaces: 'veth-runner 42 99\neth0 2 2\n',
    processes: live
      ? `10|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-docker.service|2-3|/usr/lib/systemd/systemd|-\n11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-containerd.service|2-3|/usr/lib/systemd/systemd|-\n41|1|/opt/node/bin/node|${'c'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/usr/lib/systemd/systemd|-\n42|41|/opt/runner/bin/Runner.Listener|${'d'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/opt/node/bin/node|${'c'.repeat(64)}\n`
      : `10|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-docker.service|2-3|/usr/lib/systemd/systemd|-\n11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-containerd.service|2-3|/usr/lib/systemd/systemd|-\n`,
    applications: `${live ? 'a'.repeat(64) : 'b'.repeat(64)}|true|2-3\n`,
    'production-applications': `${'d'.repeat(64)}|true|0-1\n`,
  });
  for (const [name, value] of Object.entries(sample(100, 1_000_000_000)))
    await writeFile(path.join(root, 'start', name), value);
  for (const [name, value] of Object.entries(sample(110, 11_000_000_001)))
    await writeFile(path.join(root, 'end', name), value);
  return {
    root,
    campaignId,
    family: 'inet',
    table: 'baci_cwv_measurement',
    ruleCommentPrefix: 'baci-cwv:',
    identity,
    networkAccounting: accounting,
    resources,
    processAuthority: processAuthority(`sha256:${'c'.repeat(64)}`),
    captureSha256: 'e'.repeat(64),
    policySha256: 'f'.repeat(64),
    accountingIdentitySha256: '1'.repeat(64),
  };
}

export function runtime(input, mode) {
  return mode === 'live'
    ? {
        campaignId: input.campaignId,
        generation: 1,
        runnerContainerId: 'a'.repeat(64),
        runnerIp: '172.31.0.2',
        runnerVeth: 'veth-runner',
        runnerImage: `sha256:${'c'.repeat(64)}`,
        runnerNetwork: 'baci-cwv-net',
        runnerPeerIfindex: 99,
        externalInterface: 'eth0',
        externalIfindex: 2,
        campaignMark: mark,
        processAuthority: input.processAuthority,
      }
    : {
        campaignId: input.campaignId,
        generation: 1,
        probeNetworkMode: 'none',
        probeContainerId: 'b'.repeat(64),
        probeImage: `sha256:${'c'.repeat(64)}`,
        campaignMark: mark,
        processAuthority: input.processAuthority,
      };
}
