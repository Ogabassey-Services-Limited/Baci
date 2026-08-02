import fs from 'node:fs';

import { matchesContainerStorageProjection } from './measurement-container-projection.mjs';

// A rehearsal measurement counter is intentionally absent without a runner.

const fail = (message) => {
  throw new TypeError(message);
};
const text = (root, file) => fs.readFileSync(`${root}/${file}`, 'utf8');
const json = (root, file) => {
  try {
    return JSON.parse(text(root, file));
  } catch {
    fail(`malformed ${file}`);
  }
};
const lines = (value, label) => {
  if (!value.endsWith('\n') || value.includes('\0')) fail(`malformed ${label}`);
  return value.slice(0, -1).split('\n');
};

export function readSnapshot(root, point) {
  const fields = lines(text(root, `${point}/stat`), 'cpu stat')
    .find((line) => line.startsWith('cpu '))
    ?.trim()
    .split(/ +/)
    .slice(1);
  if (fields?.length !== 10 || fields.some((item) => !/^\d+$/.test(item)))
    fail('malformed cpu stat');
  const monotonic = /^([1-9]\d*)\n$/.exec(text(root, `${point}/monotonic`));
  const monotonicEnd = /^([1-9]\d*)\n$/.exec(
    text(root, `${point}/monotonic-end`)
  );
  const load =
    /^(\d+(?:\.\d+)?) \d+(?:\.\d+)? \d+(?:\.\d+)? \d+\/\d+ \d+\n$/.exec(
      text(root, `${point}/loadavg`)
    );
  const memory = /^MemAvailable:\s+(\d+) kB\n$/.exec(
    text(root, `${point}/meminfo`)
  );
  const rootfs = /^(\d+) (\d+)\n$/.exec(text(root, `${point}/rootfs`));
  if (
    !monotonic ||
    !monotonicEnd ||
    !load ||
    !memory ||
    !rootfs ||
    BigInt(monotonicEnd[1]) < BigInt(monotonic[1])
  )
    fail('malformed snapshot');
  const available = BigInt(memory[1]) * 1024n;
  const rootFree = BigInt(rootfs[1]) * BigInt(rootfs[2]);
  if (
    available > BigInt(Number.MAX_SAFE_INTEGER) ||
    rootFree > BigInt(Number.MAX_SAFE_INTEGER)
  )
    fail('resource overflow');
  return {
    cpu: {
      steal: BigInt(fields[7]),
      total: fields.slice(0, 8).reduce((sum, item) => sum + BigInt(item), 0n),
    },
    load: Number(load[1]),
    memory: Number(available),
    monotonic: BigInt(monotonic[1]),
    monotonicEnd: BigInt(monotonicEnd[1]),
    rootFree: Number(rootFree),
  };
}

export function assertCgroup(root, point) {
  const fields = Object.fromEntries(
    lines(text(root, `${point}/cgroup`), 'cgroup').map((row) => {
      const found = /^([A-Za-z]+)=(.+)$/.exec(row);
      if (!found) fail('malformed cgroup');
      return [found[1], found[2]];
    })
  );
  const required = [
    'ActiveState',
    'SubState',
    'ControlGroup',
    'CPUAccounting',
    'MemoryAccounting',
    'IOAccounting',
  ];
  if (
    Object.keys(fields).length !== required.length ||
    required.some((key) => !Object.hasOwn(fields, key)) ||
    fields.ActiveState !== 'active' ||
    fields.SubState !== 'active' ||
    fields.ControlGroup !== '/cwv-measurement.slice' ||
    ['CPUAccounting', 'MemoryAccounting', 'IOAccounting'].some(
      (key) => fields[key] !== 'yes'
    )
  )
    fail('cgroup state');
  const events = lines(text(root, `${point}/cgroup.events`), 'cgroup events');
  if (
    events.length !== 2 ||
    !events.every((row) => /^(populated|frozen) [01]$/.test(row))
  )
    fail('cgroup events');
}

export function pressureFull(root, file) {
  const rows = lines(text(root, file), 'pressure');
  if (rows.length !== 2) fail('malformed pressure');
  const values = Object.fromEntries(
    rows.map((row) => {
      const found =
        /^(some|full) avg10=(\d+(?:\.\d+)?) avg60=(\d+(?:\.\d+)?) avg300=(\d+(?:\.\d+)?) total=(\d+)$/.exec(
          row
        );
      if (!found) fail('malformed pressure');
      return [found[1], Number(found[2])];
    })
  );
  if (
    !Object.hasOwn(values, 'some') ||
    !Object.hasOwn(values, 'full') ||
    Object.keys(values).length !== 2
  )
    fail('malformed pressure');
  return values.full;
}

export function cpuCount(root) {
  return lines(text(root, 'end/stat'), 'cpu stat').filter((row) =>
    /^cpu\d+ /.test(row)
  ).length;
}

function projection(root, point) {
  const value = json(root, `${point}/runner`);
  if (!Array.isArray(value) || value.length !== 20) fail('runner projection');
  const [
    id,
    image,
    running,
    pid,
    networkMode,
    cgroupParent,
    cpuset,
    memory,
    memorySwap,
    pids,
    shm,
    readOnly,
    privileged,
    capAdd,
    capDrop,
    securityOpt,
    binds,
    mounts,
    tmpfs,
    networks,
  ] = value;
  if (
    !Array.isArray(capDrop) ||
    !Array.isArray(securityOpt) ||
    !Array.isArray(mounts) ||
    !networks ||
    typeof networks !== 'object' ||
    Array.isArray(networks)
  )
    fail('runner projection');
  return {
    id,
    image,
    running,
    pid,
    networkMode,
    cgroupParent,
    cpuset,
    memory,
    memorySwap,
    pids,
    shm,
    readOnly,
    privileged,
    capAdd,
    capDrop,
    securityOpt,
    binds,
    mounts,
    tmpfs,
    networks,
  };
}

function interfaces(root, point) {
  return Object.fromEntries(
    lines(text(root, `${point}/interfaces`), 'interfaces').map((row) => {
      const found = /^([A-Za-z0-9_.-]{1,15}) ([1-9]\d*) ([1-9]\d*)$/.exec(row);
      if (!found) fail('malformed interfaces');
      return [
        found[1],
        { ifindex: Number(found[2]), iflink: Number(found[3]) },
      ];
    })
  );
}

const same = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((item, index) => item === expected[index]);

function assertContainerPolicy(runner, runtime, resources, rehearsal) {
  const expectedId = rehearsal
    ? runtime.probeContainerId
    : runtime.runnerContainerId;
  const expectedImage = rehearsal ? runtime.probeImage : runtime.runnerImage;
  const expectedNetwork = rehearsal ? 'none' : runtime.runnerNetwork;
  if (
    runner.id !== expectedId ||
    runner.image !== expectedImage ||
    runner.running !== true ||
    !Number.isInteger(runner.pid) ||
    runner.pid < 2 ||
    runner.networkMode !== expectedNetwork ||
    runner.cgroupParent !== 'cwv-measurement.slice' ||
    runner.cpuset !== resources.measurementCpuSet ||
    runner.memory !== resources.memoryBytes ||
    runner.memorySwap !== resources.memoryBytes + resources.memorySwapBytes ||
    runner.pids !== resources.pidsLimit ||
    runner.shm !== resources.shmBytes ||
    runner.readOnly !== true ||
    runner.privileged !== false ||
    !(
      runner.capAdd === null ||
      (Array.isArray(runner.capAdd) && !runner.capAdd.length)
    ) ||
    !same(runner.capDrop, ['ALL']) ||
    !same(runner.securityOpt, ['no-new-privileges=true']) ||
    !matchesContainerStorageProjection(runner, rehearsal)
  )
    fail(rehearsal ? 'rehearsal probe' : 'runner policy');
}

export function assertRuntime(root, point, runtime, resources) {
  const runner = projection(root, point);
  assertContainerPolicy(runner, runtime, resources, false);
  if (
    !runtime.runnerNetwork ||
    !runtime.runnerImage ||
    Object.keys(runner.networks).length !== 1 ||
    !Object.hasOwn(runner.networks, runtime.runnerNetwork)
  )
    fail('runner identity');
  if (runner.networks[runtime.runnerNetwork]?.IPAddress !== runtime.runnerIp)
    fail('runner ip');
  const links = interfaces(root, point);
  if (
    links[runtime.runnerVeth]?.iflink !== runtime.runnerPeerIfindex ||
    links[runtime.externalInterface]?.ifindex !== runtime.externalIfindex
  )
    fail('runner veth or external interface');
  const mark = `mark=${runtime.campaignMark}`;
  const marked = lines(text(root, `${point}/conntrack`), 'conntrack').filter(
    (row) => row.includes(mark)
  );
  if (
    !marked.length ||
    marked.some((row) => !tupleHasIp(row, runtime.runnerIp))
  )
    fail('conntrack runner tuple');
}

function tupleHasIp(row, ip) {
  const fields = row
    .split(/\s+/)
    .filter((field) => /^(?:src|dst)=/.test(field));
  return fields.length === 4 && fields.some((field) => field.slice(4) === ip);
}
