import { createHash } from 'node:crypto';
import fs from 'node:fs';

import { evaluateTrafficInterval } from './campaign-traffic.mjs';
import {
  accountingDigests,
  counters,
  evidenceDigests,
} from './host-idle-network.mjs';
import {
  assertCgroup,
  assertRuntime,
  cpuCount,
  pressureFull,
  readSnapshot,
} from './host-idle-snapshot.mjs';
import {
  assertApplicationContainers,
  assertForwarding,
  assertIdentity,
  assertProbe,
  assertProcesses,
} from './host-idle-validation.mjs';

const fail = (message) => {
  throw new TypeError(message);
};
const sha = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const threshold = (
  value,
  limit,
  label,
  compare = (left, right) => left > right
) => {
  if (!Number.isFinite(limit) || limit < 0 || compare(value, limit))
    fail(`${label} threshold`);
};

export function evaluateIdleSample(input) {
  const { root, mode, campaignId, runtime, thresholds, resources } = input;
  assertIdentity(input);
  if (
    !/^[a-f0-9]{64}$/.test(input.captureSha256 ?? '') ||
    !/^[a-f0-9]{64}$/.test(input.policySha256 ?? '') ||
    !/^[a-f0-9]{64}$/.test(input.accountingIdentitySha256 ?? '')
  )
    fail('sample binding');
  if (
    !Number.isSafeInteger(thresholds?.networkSampleSeconds) ||
    !Number.isSafeInteger(thresholds?.commandTimeoutSeconds) ||
    thresholds.networkSampleSeconds < 1 ||
    thresholds.commandTimeoutSeconds < 1
  )
    fail('malformed thresholds');
  if (
    !resources ||
    ![
      'measurementCpuSet',
      'otherCpuSet',
      'memoryBytes',
      'memorySwapBytes',
      'pidsLimit',
      'shmBytes',
    ].every((key) => Object.hasOwn(resources, key))
  )
    fail('resource policy');
  const [start, end] = ['start', 'end'].map((point) =>
    readSnapshot(root, point)
  );
  for (const point of ['start', 'end']) {
    assertCgroup(root, point);
    assertForwarding(root, point);
    assertProcesses(root, point, runtime, resources, mode);
    assertApplicationContainers(root, point, runtime, resources);
  }
  const elapsed = end.monotonic - start.monotonicEnd;
  const minimum = BigInt(thresholds.networkSampleSeconds) * 1_000_000_000n;
  const maximum = minimum + 1_000_000_000n;
  if (elapsed < minimum || elapsed > maximum) fail('sample interval');
  const cpus = cpuCount(root);
  if (cpus < 1) fail('cpu count');
  const load1PerCpu = end.load / cpus;
  threshold(load1PerCpu, thresholds.load1Max, 'load1');
  for (const [name, maximumPsi] of [
    ['cpu', thresholds.cpuPsiFullAvg10Max],
    ['io', thresholds.ioPsiFullAvg10Max],
    ['memory', thresholds.memoryPsiFullAvg10Max],
  ])
    threshold(pressureFull(root, `end/${name}`), maximumPsi, `${name} psi`);
  threshold(
    start.memory,
    thresholds.availableMemoryBytesMin,
    'available memory',
    (value, limit) => value < limit
  );
  threshold(
    start.rootFree,
    thresholds.rootFreeBytesMin,
    'root free',
    (value, limit) => value < limit
  );
  const total = end.cpu.total - start.cpu.total;
  if (total <= 0n || end.cpu.steal < start.cpu.steal) fail('cpu accounting');
  const stealPercent =
    Number(((end.cpu.steal - start.cpu.steal) * 10_000n) / total) / 100;
  threshold(stealPercent, thresholds.cpuStealPercentMax, 'cpu steal');
  for (const point of ['start', 'end'])
    mode === 'live'
      ? assertRuntime(root, point, runtime, resources)
      : assertProbe(root, point, runtime, resources);
  const startCounters = counters(root, 'start', input);
  const endCounters = counters(root, 'end', input);
  if (
    mode === 'rehearsal' &&
    [
      startCounters.measurementIngress,
      startCounters.measurementEgress,
      endCounters.measurementIngress,
      endCounters.measurementEgress,
    ].some((value) => value !== 0)
  )
    fail('rehearsal measurement counters');
  const traffic = evaluateTrafficInterval({
    start: startCounters,
    end: endCounters,
    intervalSeconds: thresholds.networkSampleSeconds,
    thresholds,
  });
  const evidenceDigest = {
    end: evidenceDigests(root, 'end'),
    start: evidenceDigests(root, 'start'),
  };
  const evidence = {
    boundaries: {
      elapsedNanoseconds: elapsed.toString(),
      endMonotonicNanoseconds: end.monotonic.toString(),
      startMonotonicNanoseconds: start.monotonic.toString(),
      startReadEndNanoseconds: start.monotonicEnd.toString(),
    },
    captureSha256: input.captureSha256,
    accounting: {
      end: accountingDigests(root, 'end'),
      start: accountingDigests(root, 'start'),
    },
    cgroup: {
      end: {
        events: evidenceDigest.end.cgroup_events,
        processes: evidenceDigest.end.processes,
        state: evidenceDigest.end.cgroup,
      },
      start: {
        events: evidenceDigest.start.cgroup_events,
        processes: evidenceDigest.start.processes,
        state: evidenceDigest.start.cgroup,
      },
    },
    conntrack: {
      end: evidenceDigest.end.conntrack,
      start: evidenceDigest.start.conntrack,
    },
    container: {
      end: evidenceDigest.end.runner,
      start: evidenceDigest.start.runner,
    },
    counters: { end: endCounters, start: startCounters },
    deltas: traffic,
    nft: {
      end: evidenceDigest.end.nft,
      start: evidenceDigest.start.nft,
    },
    veth: {
      end: evidenceDigest.end.interfaces,
      start: evidenceDigest.start.interfaces,
    },
  };
  const binding = {
    accountingIdentitySha256: input.accountingIdentitySha256,
    accountingTable: input.table,
    campaignId,
    campaignMark: runtime.campaignMark,
    captureSha256: input.captureSha256,
    externalIfindex: runtime.externalIfindex,
    externalInterface: runtime.externalInterface,
    generation: runtime.generation,
    policySha256: input.policySha256,
    runnerContainerId: runtime.runnerContainerId,
    runnerIp: runtime.runnerIp,
    runnerPeerIfindex: runtime.runnerPeerIfindex,
    runnerVeth: runtime.runnerVeth,
  };
  if (mode === 'rehearsal') {
    delete binding.externalIfindex;
    delete binding.externalInterface;
    delete binding.runnerContainerId;
    delete binding.runnerIp;
    delete binding.runnerPeerIfindex;
    delete binding.runnerVeth;
  }
  return {
    accepted: true,
    ambientEgressBytes: traffic.ambientEgressBytes,
    ambientIngressBytes: traffic.ambientIngressBytes,
    binding,
    campaignId,
    evidence,
    load1PerCpu,
    measurementEgressBytes: traffic.measurementEgressBytes,
    measurementIngressBytes: traffic.measurementIngressBytes,
    mode,
    stealPercent,
    thresholds,
  };
}

export function sampleSha256(root, point) {
  return sha(fs.readFileSync(`${root}/${point}/nft`));
}
export function canonicalEvidence(value) {
  return canonical(value);
}

if (import.meta.filename === process.argv[1]) {
  const [, root, input] = process.argv.slice(2);
  try {
    if (!root || !input || process.argv.length !== 5)
      fail('invalid evaluator command');
    process.stdout.write(
      `${canonical(evaluateIdleSample({ root, ...JSON.parse(fs.readFileSync(input, 'utf8')) }))}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 65;
  }
}
