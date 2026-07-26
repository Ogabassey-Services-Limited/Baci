import fs from 'node:fs';

export { assertProcesses } from './host-idle-process-authority.mjs';

const CAMPAIGN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const CONTAINER = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const INTERFACE = /^[A-Za-z0-9_.-]{1,15}$/;
const fail = (message) => {
  throw new TypeError(message);
};
const read = (root, file) => fs.readFileSync(`${root}/${file}`, 'utf8');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

export function assertIdentity(input) {
  const {
    campaignId,
    family,
    table,
    identity,
    runtime,
    mode,
    ruleCommentPrefix,
    networkAccounting,
  } = input;
  if (
    typeof campaignId !== 'string' ||
    !CAMPAIGN.test(campaignId) ||
    family !== 'inet' ||
    table !== 'baci_cwv_measurement' ||
    ruleCommentPrefix !== 'baci-cwv:'
  )
    fail('campaign identity');
  if (
    identity?.schemaVersion !== 1 ||
    identity.family !== family ||
    identity.table !== table ||
    !Number.isInteger(identity.tableHandle) ||
    identity.tableHandle < 1 ||
    !Number.isInteger(identity.campaignMark) ||
    identity.campaignMark < 0 ||
    identity.campaignMark > 0xffffffff ||
    typeof identity.externalInterface !== 'string' ||
    !INTERFACE.test(identity.externalInterface) ||
    !identity.chainHandles ||
    !identity.handles
  )
    fail('accounting identity');
  const topology = [
    'classifyChain',
    'classifyHook',
    'classifyPriority',
    'ingressChain',
    'ingressHook',
    'hostIngressChain',
    'hostIngressHook',
    'egressChain',
    'hostEgressChain',
    'egressHook',
    'counterPriority',
  ];
  if (
    !networkAccounting ||
    !topology.every((key) => Object.hasOwn(networkAccounting, key))
  )
    fail('accounting topology');
  if (
    !runtime ||
    runtime.campaignId !== campaignId ||
    runtime.generation !== 1 ||
    runtime.campaignMark !== identity.campaignMark
  )
    fail('runtime generation');
  if (mode === 'live') {
    if (
      !identity.readyForSampling ||
      identity.runnerInterface !== runtime.runnerVeth ||
      !CONTAINER.test(runtime.runnerContainerId) ||
      !IMAGE.test(runtime.runnerImage) ||
      runtime.runnerNetwork !== 'baci-cwv-net' ||
      typeof runtime.runnerVeth !== 'string' ||
      !INTERFACE.test(runtime.runnerVeth) ||
      typeof runtime.externalInterface !== 'string' ||
      !INTERFACE.test(runtime.externalInterface) ||
      runtime.externalInterface !== identity.externalInterface ||
      !Number.isInteger(runtime.runnerPeerIfindex) ||
      runtime.runnerPeerIfindex < 1 ||
      !Number.isInteger(runtime.externalIfindex) ||
      runtime.externalIfindex < 1
    )
      fail('runner identity');
  } else if (mode === 'rehearsal') {
    if (
      identity.readyForSampling ||
      identity.runnerInterface !== null ||
      runtime.probeNetworkMode !== 'none' ||
      !CONTAINER.test(runtime.probeContainerId) ||
      !IMAGE.test(runtime.probeImage) ||
      runtime.runnerVeth !== undefined
    )
      fail('rehearsal runtime');
  } else fail('sample mode');
}

export function assertForwarding(root, point) {
  if (read(root, `${point}/ip_forward`) !== '1\n') fail('ip forwarding drift');
}

export function assertProbe(root, point, runtime, resources) {
  let value;
  try {
    value = JSON.parse(read(root, `${point}/runner`));
  } catch {
    fail('probe projection');
  }
  if (!Array.isArray(value) || value.length !== 20) fail('probe projection');
  const [
    id,
    image,
    running,
    ,
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
  const same = (actual, expected) =>
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index]);
  const empty = (item) =>
    item === null || (Array.isArray(item) && !item.length);
  const tmpfsPolicy = {
    '/home/runner': 'rw,noexec,nosuid,nodev,size=16777216,mode=700',
    '/tmp': 'rw,noexec,nosuid,nodev,size=16777216,mode=1777',
  };
  if (
    id !== runtime.probeContainerId ||
    image !== runtime.probeImage ||
    running !== true ||
    networkMode !== 'none' ||
    cgroupParent !== 'cwv-measurement.slice' ||
    cpuset !== resources.measurementCpuSet ||
    memory !== resources.memoryBytes ||
    memorySwap !== resources.memoryBytes + resources.memorySwapBytes ||
    pids !== resources.pidsLimit ||
    shm !== resources.shmBytes ||
    readOnly !== true ||
    privileged !== false ||
    !empty(capAdd) ||
    !same(capDrop, ['ALL']) ||
    !same(securityOpt, ['no-new-privileges=true']) ||
    !empty(binds) ||
    !empty(mounts) ||
    canonical(tmpfs) !== canonical(tmpfsPolicy) ||
    !networks ||
    Object.keys(networks).length !== 0
  )
    fail('rehearsal probe');
}

export function assertApplicationContainers(root, point, runtime, resources) {
  const rows = read(root, `${point}/applications`)
    .trim()
    .split('\n')
    .filter(Boolean);
  if (rows.some((row) => !/^[a-f0-9]{64}\|true\|[0-9,-]+$/.test(row)))
    fail('application projection');
  const measurementId = runtime.runnerContainerId ?? runtime.probeContainerId;
  const seen = new Set();
  for (const row of rows) {
    const [id, running, cpuset] = row.split('|');
    if (seen.has(id)) fail('application projection');
    seen.add(id);
    if (id === measurementId) {
      if (running !== 'true' || cpuset !== resources.measurementCpuSet)
        fail('measurement cpuset');
    } else if (cpuset !== resources.otherCpuSet) fail('application cpuset');
  }
  if (!seen.has(measurementId)) fail('measurement application missing');
  const production = read(root, `${point}/production-applications`)
    .trim()
    .split('\n')
    .filter(Boolean);
  const productionIds = new Set();
  for (const row of production) {
    if (!/^[a-f0-9]{64}\|true\|[0-9,-]+$/.test(row))
      fail('production application projection');
    const [id, , cpuset] = row.split('|');
    if (productionIds.has(id) || cpuset !== resources.otherCpuSet)
      fail('production application cpuset');
    productionIds.add(id);
  }
}
