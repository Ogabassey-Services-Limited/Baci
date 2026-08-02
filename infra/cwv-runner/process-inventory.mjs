// biome-ignore-all format: compact collector logic stays within the source ceiling.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';
import {
  normalContainerIdentity,
  parseCanonicalNormalRelease,
} from './normal-release.mjs';

const PHASES = ['held', 'listener-idle', 'assigned', 'cleanup'];
const ROLES = new Set([
  'bash',
  'runtimeNode',
  'listener',
  'worker',
  'pluginHost',
  'actionNode',
  'git',
  'gitRemoteHttps',
]);
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
const MAP_KEYS = ['entries', 'phases', 'receiptBinding', 'schemaVersion', 'sealed'];
const ENTRY_KEYS = [
  'maxInstancesByPhase',
  'mode',
  'owner',
  'path',
  'realpath',
  'role',
  'sha256',
];
const ALLOW_KEYS = [
  'admissionId',
  'campaignId',
  'expectedSha',
  'expiresMonotonicSeconds',
  'kind',
  'policyFileSha256',
  'repository',
  'run',
  'runner',
  'schemaVersion',
  'workflow',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const fail = (message) => {
  throw new TypeError(`process inventory refused: ${message}`);
};
const canonicalObject = (raw, name) => {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail(`${name} JSON`);
  }
  if (`${canonicalJson(value)}\n` !== raw) fail(`${name} canonical bytes`);
  return value;
};

function allowRecord(raw) {
  const allow = canonicalObject(raw, 'allow');
  if (
    !exactKeys(allow, ALLOW_KEYS) ||
    allow.schemaVersion !== 1 ||
    allow.kind !== 'allow' ||
    !/^[0-9a-f]{64}$/.test(allow.admissionId) ||
    !/^[0-9a-f]{40}$/.test(allow.expectedSha) ||
    !/^[0-9a-f]{64}$/.test(allow.policyFileSha256) ||
    !Number.isSafeInteger(allow.run?.id) ||
    allow.run.id < 1 ||
    !Number.isSafeInteger(allow.runner?.generation) ||
    allow.runner.generation < 1
  )
    fail('allow binding');
  return allow;
}

function processMap(raw) {
  const map = canonicalObject(raw, 'process map');
  if (
    !exactKeys(map, MAP_KEYS) ||
    map.schemaVersion !== 1 ||
    map.receiptBinding !== 'image-process-map-v1' ||
    canonicalJson(map.phases) !== canonicalJson(PHASES) ||
    !Array.isArray(map.entries) ||
    !Array.isArray(map.sealed)
  )
    fail('process map');
  const entries = new Map();
  for (const entry of map.entries) {
    if (
      !exactKeys(entry, ENTRY_KEYS) ||
      !ROLES.has(entry.role) ||
      entries.has(entry.role) ||
      entry.realpath !== entry.path ||
      !/^\/[A-Za-z0-9._+@:/-]+$/.test(entry.path) ||
      !/^[0-9a-f]{64}$/.test(entry.sha256) ||
      entry.owner !== '0:0' ||
      !/^[0-7]{4}$/.test(entry.mode) ||
      (Number.parseInt(entry.mode, 8) & 0o022) !== 0 ||
      !Array.isArray(entry.maxInstancesByPhase) ||
      entry.maxInstancesByPhase.length !== PHASES.length ||
      entry.maxInstancesByPhase.some(
        (maximum) => !Number.isSafeInteger(maximum) || maximum < 0
      )
    )
      fail('process map entry');
    entries.set(entry.role, entry);
  }
  if (entries.size !== ROLES.size) fail('process map roles');
  const sealed = new Map();
  for (const entry of map.sealed) {
    if (
      !exactKeys(entry, ['mode', 'owner', 'path', 'realpath', 'sha256']) ||
      sealed.has(entry.path) ||
      entry.realpath !== entry.path ||
      entry.owner !== '0:0' ||
      !/^[0-7]{4}$/.test(entry.mode) ||
      (Number.parseInt(entry.mode, 8) & 0o022) !== 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256)
    )
      fail('sealed process map entry');
    sealed.set(entry.path, entry.sha256);
  }
  for (const entry of entries.values())
    if (sealed.get(entry.path) !== entry.sha256) fail('sealed process map');
  return entries;
}

function stablePids(procRoot, collectorPid) {
  return readdirSync(procRoot)
    .filter((entry) => /^(?:0|[1-9][0-9]*)$/.test(entry))
    .map(Number)
    .filter((pid) => pid !== collectorPid)
    .sort((left, right) => left - right);
}

function parentPid(raw) {
  const match = /^(?:[1-9][0-9]*) \(.*\) \S+ ([0-9]+) /.exec(raw);
  if (!match) fail('process stat');
  return Number(match[1]);
}

function collectProcess({ cgroupPath, cgroupRoot, entries, generation, pathRoot, pid, procRoot, runnerContainerId, runId, visibleCgroup }) {
  const directory = `${procRoot}/${pid}`;
  const rawCgroup = readFileSync(`${directory}/cgroup`, 'utf8');
  const stat = readFileSync(`${directory}/stat`, 'utf8');
  if (rawCgroup !== `0::${visibleCgroup}\n`) fail('process cgroup');
  const physicalExe = readlinkSync(`${directory}/exe`);
  const exe = pathRoot ? physicalExe.slice(pathRoot.length) : physicalExe;
  if (!exe.startsWith('/') || (pathRoot && !physicalExe.startsWith(`${pathRoot}/`)))
    fail('process executable path');
  const digest = sha256(readFileSync(physicalExe));
  if (
    readlinkSync(`${directory}/exe`) !== physicalExe ||
    readFileSync(`${directory}/stat`, 'utf8') !== stat
  )
    fail('process snapshot race');
  const entry = [...entries.values()].find(
    (candidate) => candidate.path === exe && candidate.sha256 === digest
  );
  if (!entry) fail('process executable');
  const visibleCgroupPath = visibleCgroup === '/' ? '' : visibleCgroup;
  const cpuset = readFileSync(
    `${cgroupRoot}${visibleCgroupPath}/cpuset.cpus.effective`,
    'utf8'
  );
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*\n$/.test(cpuset))
    fail('process cpuset');
  const process = {
    cgroupPath,
    containerId: runnerContainerId,
    cpuset: cpuset.trim(),
    exe,
    generation,
    parentPid: parentPid(stat),
    pid,
    role: entry.role,
    sha256: digest,
  };
  if (entry.role === 'worker') process.runId = runId;
  return process;
}

function phaseFor(processes, entries) {
  const counts = Object.fromEntries([...ROLES].map((role) => [role, 0]));
  const byPid = new Map();
  for (const process of processes) {
    counts[process.role] += 1;
    if (byPid.has(process.pid)) fail('duplicate process pid');
    byPid.set(process.pid, process);
  }
  const phase = counts.worker ? 'assigned' : counts.listener ? 'listener-idle' : 'held';
  if (counts.listener > 1 || counts.worker > 1 || (counts.worker && counts.listener !== 1))
    fail('process phase');
  const phaseIndex = PHASES.indexOf(phase);
  for (const [role, entry] of entries)
    if (counts[role] > entry.maxInstancesByPhase[phaseIndex])
      fail('process maximum');
  for (const process of processes) {
    const parent = byPid.get(process.parentPid);
    if (PARENTS[process.role].length === 0) {
      process.parentPid = 0;
      continue;
    }
    if (
      process.parentPid === 0 ||
      !parent ||
      !PARENTS[process.role].includes(parent.role)
    )
      fail('process ancestry');
  }
  return phase;
}

export function collectProcessInventory({
  cgroupRoot = '/sys/fs/cgroup',
  collectorPid = process.pid,
  hostnamePath = '/etc/hostname',
  listPids = stablePids,
  pathRoot = '',
  procRoot = '/proc',
  readPaths = {
    allow: '/run/baci-cwv-admission/active.json',
    map: '/opt/baci-cwv/image-process-map.json',
    release: '/run/baci-cwv-listener-release/release.json',
  },
} = {}) {
  const allow = allowRecord(readFileSync(readPaths.allow, 'utf8'));
  const releaseRaw = readFileSync(readPaths.release, 'utf8');
  const release = canonicalObject(releaseRaw, 'release');
  normalContainerIdentity(readFileSync(hostnamePath, 'utf8'), release.containerId);
  parseCanonicalNormalRelease(
    releaseRaw,
    {
      campaignId: allow.campaignId,
      containerId: release.containerId,
      policyFileSha256: allow.policyFileSha256,
    },
    release.createdMonotonicSeconds,
    release.expiresMonotonicSeconds
  );
  const entries = processMap(readFileSync(readPaths.map, 'utf8'));
  const cgroupPath = `/cwv-measurement.slice/docker-${release.containerId}.scope`;
  const first = listPids(procRoot, collectorPid);
  if (!first.length) fail('process snapshot');
  const visibleCgroupMatch = /^0::(\/[^\n]*)\n$/.exec(
    readFileSync(`${procRoot}/${first[0]}/cgroup`, 'utf8')
  );
  if (!visibleCgroupMatch) fail('process cgroup');
  const visibleCgroup = visibleCgroupMatch[1];
  const readProcesses = () => first.map((pid) =>
    collectProcess({
      cgroupPath,
      cgroupRoot,
      entries,
      generation: allow.runner.generation,
      pathRoot,
      pid,
      procRoot,
      runnerContainerId: release.containerId,
      runId: allow.run.id,
      visibleCgroup,
    })
  );
  const processes = readProcesses();
  if (canonicalJson(first) !== canonicalJson(listPids(procRoot, collectorPid)))
    fail('process snapshot race');
  if (
    canonicalJson(processes) !== canonicalJson(readProcesses()) ||
    canonicalJson(first) !== canonicalJson(listPids(procRoot, collectorPid))
  )
    fail('process snapshot race');
  const phase = phaseFor(processes, entries);
  return { busy: phase === 'assigned', phase, processes };
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.stdout.write(`${canonicalJson(collectProcessInventory())}\n`);
