import { createHash } from 'node:crypto';

const HEX_64 = /^[a-f0-9]{64}$/;
const PHASES = ['held', 'listener-idle', 'assigned', 'cleanup'];
const ROLES = [
  'bash',
  'runtimeNode',
  'listener',
  'worker',
  'pluginHost',
  'actionNode',
  'git',
  'gitRemoteHttps',
];
const PARENTS = Object.freeze({
  actionNode: ['worker', 'pluginHost'],
  bash: [],
  git: ['worker', 'pluginHost', 'actionNode', 'bash'],
  gitRemoteHttps: ['git'],
  listener: ['runtimeNode'],
  pluginHost: ['worker'],
  runtimeNode: [],
  worker: ['listener'],
});
const measurementCgroupPath = (runnerContainerId) =>
  `/cwv-measurement.slice/docker-${runnerContainerId}.scope`;

const fail = (message) => {
  throw new Error(message);
};
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const exact = (value, keys, name) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    canonical(Object.keys(value).sort()) !== canonical([...keys].sort())
  )
    fail(`${name} keys are invalid`);
};
const integer = (value, name, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    fail(`${name} is invalid`);
};

export const processMapDigest = (map) =>
  createHash('sha256').update(canonical(map)).digest('hex');

function mapEntries(map) {
  exact(
    map,
    ['entries', 'phases', 'receiptBinding', 'schemaVersion', 'sealed'],
    'process map'
  );
  if (
    map.schemaVersion !== 1 ||
    map.receiptBinding !== 'image-process-map-v1' ||
    canonical(map.phases) !== canonical(PHASES) ||
    !Array.isArray(map.entries) ||
    map.entries.length !== ROLES.length ||
    !Array.isArray(map.sealed)
  )
    fail('process map is invalid');
  const byRole = new Map();
  for (const entry of map.entries) {
    exact(
      entry,
      [
        'maxInstancesByPhase',
        'mode',
        'owner',
        'path',
        'realpath',
        'role',
        'sha256',
      ],
      'process map entry'
    );
    if (
      !ROLES.includes(entry.role) ||
      byRole.has(entry.role) ||
      typeof entry.path !== 'string' ||
      entry.path === '' ||
      entry.realpath !== entry.path ||
      !HEX_64.test(entry.sha256) ||
      !/^\d+:\d+$/.test(entry.owner) ||
      !/^[0-7]{4}$/.test(entry.mode) ||
      !Array.isArray(entry.maxInstancesByPhase) ||
      entry.maxInstancesByPhase.length !== PHASES.length
    )
      fail('process map entry is invalid');
    for (const maximum of entry.maxInstancesByPhase)
      integer(maximum, 'process maximum');
    byRole.set(entry.role, entry);
  }
  if (ROLES.some((role) => !byRole.has(role)))
    fail('process map role is missing');
  return byRole;
}

function validateIdentity(identity, map) {
  exact(
    identity,
    [
      'cgroupPath',
      'cpuset',
      'generation',
      'processMapSha256',
      'runnerContainerId',
    ],
    'process identity'
  );
  if (
    !/^\/[A-Za-z0-9._/@:+-]+$/.test(identity.cgroupPath) ||
    !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(identity.cpuset) ||
    !HEX_64.test(identity.runnerContainerId) ||
    !HEX_64.test(identity.processMapSha256) ||
    identity.cgroupPath !== measurementCgroupPath(identity.runnerContainerId)
  )
    fail('process identity is invalid');
  integer(identity.generation, 'process generation', 1);
  if (identity.processMapSha256 !== processMapDigest(map))
    fail('process map digest mismatch');
}

function phaseIndex(phase) {
  const index = PHASES.indexOf(phase);
  if (index === -1) fail('process phase is invalid');
  return index;
}

function validateProcess(process, identity, entries) {
  const keys = [
    'cgroupPath',
    'containerId',
    'cpuset',
    'exe',
    'generation',
    'parentPid',
    'pid',
    'role',
    'sha256',
  ];
  if (process?.role === 'worker') keys.push('runId');
  exact(process, keys, 'process');
  integer(process.pid, 'process pid', 1);
  integer(process.parentPid, 'process parent pid');
  integer(process.generation, 'process generation', 1);
  if (
    !entries.has(process.role) ||
    process.cgroupPath !== identity.cgroupPath ||
    process.containerId !== identity.runnerContainerId ||
    process.cpuset !== identity.cpuset ||
    process.generation !== identity.generation
  )
    fail('process identity mismatch');
  const entry = entries.get(process.role);
  if (process.exe !== entry.path || process.sha256 !== entry.sha256)
    fail('process executable mismatch');
}

function validateAncestry(processes) {
  const byPid = new Map();
  for (const process of processes) {
    if (byPid.has(process.pid)) fail('duplicate process pid');
    byPid.set(process.pid, process);
  }
  for (const process of processes) {
    const parents = PARENTS[process.role];
    if (process.parentPid === 0) {
      if (parents.length !== 0) fail('process ancestry mismatch');
      continue;
    }
    const parent = byPid.get(process.parentPid);
    if (!parent || !parents.includes(parent.role))
      fail('process ancestry mismatch');
  }
}

export function validateSealedProcessInventory({
  busy,
  expectedRunId,
  identity,
  phase,
  processMap,
  processes,
}) {
  if (!Array.isArray(processes)) fail('process inventory must be an array');
  if (phase === 'terminal') {
    if (busy || processes.length) fail('terminal inventory must be empty');
    return { listenerCount: 0, workerCount: 0 };
  }
  const entries = mapEntries(processMap);
  validateIdentity(identity, processMap);
  const index = phaseIndex(phase);
  for (const process of processes) validateProcess(process, identity, entries);
  validateAncestry(processes);
  const counts = Object.fromEntries(ROLES.map((role) => [role, 0]));
  for (const process of processes) counts[process.role] += 1;
  for (const [role, entry] of entries)
    if (counts[role] > entry.maxInstancesByPhase[index])
      fail('process phase maximum exceeded');
  if ((phase === 'held' || phase === 'listener-idle') !== !busy)
    fail('process busy phase mismatch');
  if (phase !== 'held' && counts.listener !== 1)
    fail('listener process cardinality mismatch');
  if (
    (phase === 'assigned' || phase === 'cleanup') &&
    (counts.worker !== 1 ||
      processes.find((process) => process.role === 'worker').runId !==
        expectedRunId)
  )
    fail('worker run binding mismatch');
  return { listenerCount: counts.listener, workerCount: counts.worker };
}
