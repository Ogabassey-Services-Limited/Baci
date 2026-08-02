import { createHash } from 'node:crypto';
import fs from 'node:fs';

const HEX = /^[a-f0-9]{64}$/;
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
const PARENTS = {
  actionNode: ['worker', 'pluginHost'],
  bash: [],
  git: ['worker', 'pluginHost', 'actionNode', 'bash'],
  gitRemoteHttps: ['git'],
  listener: ['runtimeNode'],
  pluginHost: ['worker'],
  runtimeNode: [],
  worker: ['listener'],
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
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonical(Object.keys(value).sort()) === canonical([...keys].sort());
const fail = (message) => {
  throw new TypeError(message);
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function authority(value, runtime) {
  if (
    !exact(value, [
      'hostBinaries',
      'identityContractSha256',
      'imageId',
      'imageReceiptSha256',
      'processMap',
      'processMapSha256',
      'schemaVersion',
    ]) ||
    value.schemaVersion !== 1 ||
    !HEX.test(value.identityContractSha256) ||
    !HEX.test(value.imageReceiptSha256) ||
    !HEX.test(value.processMapSha256) ||
    value.imageId !== (runtime.runnerImage ?? runtime.probeImage)
  )
    fail('process authority');
  const host = value.hostBinaries;
  if (
    !exact(host, [
      'containerdBuild',
      'containerdSha256',
      'containerdVersion',
      'dockerBuild',
      'dockerSha256',
      'dockerVersion',
    ]) ||
    !HEX.test(host.dockerSha256) ||
    !HEX.test(host.containerdSha256)
  )
    fail('process authority');
  const map = value.processMap;
  if (
    !exact(map, [
      'entries',
      'phases',
      'receiptBinding',
      'schemaVersion',
      'sealed',
    ]) ||
    map.schemaVersion !== 1 ||
    map.receiptBinding !== 'image-process-map-v1' ||
    canonical(map.phases) !==
      canonical(['held', 'listener-idle', 'assigned', 'cleanup']) ||
    !Array.isArray(map.entries) ||
    !Array.isArray(map.sealed) ||
    map.entries.length !== ROLES.length
  )
    fail('process authority');
  if (sha256(canonical(map)) !== value.processMapSha256)
    fail('process authority');
  const entries = new Map();
  const sealed = new Map();
  for (const entry of map.entries) {
    if (
      !exact(entry, [
        'maxInstancesByPhase',
        'mode',
        'owner',
        'path',
        'realpath',
        'role',
        'sha256',
      ]) ||
      !ROLES.includes(entry.role) ||
      entries.has(entry.role) ||
      entry.realpath !== entry.path ||
      !/^\/[A-Za-z0-9._+@:/-]+$/.test(entry.path) ||
      !HEX.test(entry.sha256) ||
      !Array.isArray(entry.maxInstancesByPhase) ||
      entry.maxInstancesByPhase.length !== map.phases.length ||
      entry.maxInstancesByPhase.some(
        (count) => !Number.isSafeInteger(count) || count < 0
      )
    )
      fail('process authority');
    entries.set(entry.role, entry);
  }
  for (const entry of map.sealed) {
    if (
      !exact(entry, ['mode', 'owner', 'path', 'realpath', 'sha256']) ||
      sealed.has(entry.path) ||
      entry.realpath !== entry.path ||
      !HEX.test(entry.sha256)
    )
      fail('process authority');
    sealed.set(entry.path, entry);
  }
  if (
    ROLES.some(
      (role) =>
        !entries.has(role) ||
        sealed.get(entries.get(role).path)?.sha256 !== entries.get(role).sha256
    )
  )
    fail('process authority');
  return { entries, host };
}

export function assertProcesses(root, point, runtime, resources, mode) {
  const source = runtime?.processAuthority;
  const { entries, host } = authority(source, runtime);
  const rows = fs
    .readFileSync(`${root}/${point}/processes`, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const seen = new Set();
  const observed = new Map();
  const daemons = new Set();
  const forbidden = new Set([
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/runner/bin/Runner.Listener',
    '/opt/runner/bin/Runner.Worker',
  ]);
  for (const row of rows) {
    const [
      pid,
      parent,
      executable,
      hash,
      cgroup,
      cpuset,
      parentExecutable,
      parentHash,
    ] = row.split('|');
    if (
      !/^\d+$/.test(pid) ||
      !/^\d+$/.test(parent) ||
      !/^\//.test(executable) ||
      !(parent === '0'
        ? parentExecutable === '-' && parentHash === '-'
        : /^\//.test(parentExecutable)) ||
      !/^[0-9,-]+$/.test(cpuset) ||
      seen.has(pid)
    )
      fail('process inventory');
    seen.add(pid);
    const role = [...entries.values()].find(
      (entry) => entry.path === executable && entry.sha256 === hash
    )?.role;
    if (forbidden.has(executable) && !role) fail('external runner process');
    if (role) {
      if (mode !== 'live') fail('rehearsal process identity');
      if (
        observed.has(role) ||
        !cgroup.startsWith(
          `/cwv-measurement.slice/docker-${runtime.runnerContainerId}.scope`
        ) ||
        cpuset !== resources.measurementCpuSet
      )
        fail('measurement process identity');
      observed.set(role, { parent, parentExecutable, parentHash, pid });
    } else if (
      ['/usr/bin/dockerd', '/usr/bin/containerd'].includes(executable)
    ) {
      const expected = executable.endsWith('dockerd')
        ? host.dockerSha256
        : host.containerdSha256;
      if (
        hash !== expected ||
        !cgroup.startsWith('/cwv-measurement-control.slice') ||
        cpuset !== resources.measurementCpuSet
      )
        fail('control process identity');
      if (daemons.has(executable)) fail('control process cardinality');
      daemons.add(executable);
    } else if (
      cgroup.startsWith('/cwv-measurement') &&
      (!cgroup.startsWith('/cwv-measurement-control.slice') ||
        cpuset !== resources.measurementCpuSet)
    )
      fail('control process identity');
  }
  if (daemons.size !== 2) fail('control process cardinality');
  if (mode === 'rehearsal' && observed.size) fail('rehearsal process identity');
  const phase = source.processMap.phases.indexOf('listener-idle');
  for (const [role, entry] of entries)
    if (
      (observed.has(role) ? 1 : 0) !==
      (mode === 'live' ? entry.maxInstancesByPhase[phase] : 0)
    )
      fail('measurement process cardinality');
  for (const [role, value] of observed) {
    const parentRole = [...observed].find(
      ([, candidate]) => Number(candidate.pid) === Number(value.parent)
    )?.[0];
    if (
      !PARENTS[role].includes(parentRole) &&
      !(PARENTS[role].length === 0 && parentRole === undefined)
    )
      fail('process ancestry');
    if (
      parentRole &&
      (value.parentExecutable !== entries.get(parentRole).path ||
        value.parentHash !== entries.get(parentRole).sha256)
    )
      fail('process ancestry');
  }
}
