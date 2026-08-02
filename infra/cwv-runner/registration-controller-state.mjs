import { isDeepStrictEqual } from 'node:util';
import { assertNormalRuntimeState } from './registration-controller-normal-mode.mjs';

const phases = new Set([
  'pre-start',
  'node-started',
  'node-ready',
  'node-token-absent',
  'listener-configure',
  'post-container',
]);
const sorted = (rows) =>
  [...rows].sort((left, right) =>
    String(left.path ?? left).localeCompare(String(right.path ?? right))
  );
const phaseArtifacts = (phase, layout) =>
  ({
    'pre-start': [],
    'node-started': Object.values(layout),
    'node-ready': Object.values(layout),
    'node-token-absent': [layout.staging, layout.releaseParent, layout.handoff],
    'listener-configure': [
      layout.staging,
      layout.releaseParent,
      layout.handoff,
    ],
    'post-container': [layout.staging, layout.releaseParent, layout.handoff],
  })[phase];
const phaseMounts = (phase, layout) => {
  const mounts = {
    policy: {
      name: 'policy',
      readOnly: true,
      source: '/srv/baci-cwv/sealed/policy.sha256',
      target: '/run/baci-cwv-policy/policy.sha256',
    },
    release: {
      name: 'release',
      readOnly: true,
      source: layout.handoff.path,
      target: '/run/baci-cwv-registration-release',
    },
    staging: {
      name: 'staging',
      readOnly: false,
      source: layout.staging.path,
      target: '/registration-staging',
    },
    token: {
      name: 'token',
      readOnly: true,
      source: layout.token.path,
      target: '/run/secrets/runner-registration-token',
    },
  };
  return {
    'node-started': [
      mounts.policy,
      mounts.release,
      mounts.staging,
      mounts.token,
    ],
    'node-ready': [mounts.policy, mounts.release, mounts.staging, mounts.token],
    'node-token-absent': [
      mounts.policy,
      mounts.release,
      mounts.staging,
      mounts.token,
    ],
    'listener-configure': [
      mounts.policy,
      mounts.release,
      mounts.staging,
      mounts.token,
    ],
  }[phase];
};
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const refuse = () => {
  throw new TypeError('registration inventory refused');
};

export function observeRegistrationIdentity(snapshot, containerId) {
  const container = snapshot?.containers?.[0];
  const process = container?.processes?.[0];
  const identity = snapshot?.identity;
  const cgroupPath = identity?.cgroupPath;
  const prefix = '/sys/fs/cgroup/cwv-measurement.slice/';
  const expectedCgroupPath = `${prefix}docker-${containerId}.scope`;
  if (
    snapshot?.containers?.length !== 1 ||
    container?.containerId !== containerId ||
    !/^[a-f0-9]{64}$/.test(containerId) ||
    !Number.isSafeInteger(process?.pid) ||
    process.pid <= 0 ||
    !/^[a-f0-9]{64}$/.test(process?.parentIdentitySha256) ||
    !exactKeys(identity, [
      'cgroupAncestry',
      'cgroupPath',
      'credentials',
      'namespaces',
    ]) ||
    !/^cgroup:\[[0-9]+\]$/.test(container.cgroupNamespace) ||
    !/^mnt:\[[0-9]+\]$/.test(container.mountNamespace) ||
    !/^user:\[[0-9]+\]$/.test(container.userNamespace) ||
    typeof cgroupPath !== 'string' ||
    cgroupPath !== expectedCgroupPath ||
    !isDeepStrictEqual(identity.cgroupAncestry, [
      '/sys/fs/cgroup',
      '/sys/fs/cgroup/cwv-measurement.slice',
      cgroupPath,
    ]) ||
    !isDeepStrictEqual(identity.credentials, {
      effectiveGid: 10001,
      effectiveUid: 10001,
      realGid: 10001,
      realUid: 10001,
      savedGid: 10001,
      savedUid: 10001,
      supplementaryGroups: [10001],
    }) ||
    !isDeepStrictEqual(identity.namespaces, {
      cgroup: container.cgroupNamespace,
      mnt: container.mountNamespace,
      user: container.userNamespace,
    })
  )
    refuse();
  const runtimeIdentity = Object.freeze({
    ...identity,
    cgroupAncestry: Object.freeze([...identity.cgroupAncestry]),
    credentials: Object.freeze({
      ...identity.credentials,
      supplementaryGroups: Object.freeze([
        ...identity.credentials.supplementaryGroups,
      ]),
    }),
    namespaces: Object.freeze({ ...identity.namespaces }),
  });
  return Object.freeze({
    cgroupNamespace: container.cgroupNamespace,
    containerId,
    listenerPid: process.pid,
    mountNamespace: container.mountNamespace,
    parentIdentitySha256: process.parentIdentitySha256,
    runtimeIdentity,
    userNamespace: container.userNamespace,
  });
}

export function validateRegistrationSnapshotState(
  snapshot,
  phase,
  context,
  layout,
  authority
) {
  if (
    !phases.has(phase) ||
    snapshot?.schemaVersion !== 1 ||
    !exactKeys(snapshot, [
      'artifacts',
      'containers',
      'egress',
      'environmentSha256',
      'identity',
      'normalService',
      'schemaVersion',
    ]) ||
    !Array.isArray(snapshot.artifacts) ||
    !Array.isArray(snapshot.containers) ||
    !exactKeys(snapshot.normalService, ['active', 'enabled']) ||
    !exactKeys(snapshot.egress, ['bytes', 'mode', 'packets']) ||
    (snapshot.environmentSha256 !== null &&
      !/^[a-f0-9]{64}$/.test(snapshot.environmentSha256)) ||
    snapshot.normalService.active !== false ||
    snapshot.normalService.enabled !== false ||
    !isDeepStrictEqual(
      sorted(snapshot.artifacts),
      sorted(phaseArtifacts(phase, layout))
    )
  )
    refuse();
  const active = phase === 'listener-configure';
  if (
    snapshot.egress.mode !== (active ? 'active' : 'default-drop') ||
    !Number.isSafeInteger(snapshot.egress.packets) ||
    !Number.isSafeInteger(snapshot.egress.bytes) ||
    snapshot.egress.packets < 0 ||
    snapshot.egress.bytes < 0 ||
    (!active &&
      phase !== 'post-container' &&
      (snapshot.egress.packets !== 0 || snapshot.egress.bytes !== 0))
  )
    throw new TypeError('registration egress refused');
  const mounts = phaseMounts(phase, layout);
  if (!mounts) {
    if (snapshot.containers.length !== 0 || snapshot.identity !== null)
      refuse();
    return snapshot;
  }
  if (snapshot.containers.length !== 1) refuse();
  const container = snapshot.containers[0];
  const expectedProcess = {
    argvSha256: active ? context.configureArgvSha256 : context.nodeArgvSha256,
    containerPid: 1,
    executableSha256: active
      ? context.listenerExecutableSha256
      : context.nodeExecutableSha256,
    parentIdentitySha256:
      authority?.parentIdentitySha256 ??
      container.processes[0]?.parentIdentitySha256,
    pid: authority?.listenerPid,
  };
  if (
    !exactKeys(container, [
      'cgroupNamespace',
      'containerId',
      'mountNamespace',
      'mounts',
      'processes',
      'userNamespace',
    ]) ||
    !Array.isArray(container.mounts) ||
    !Array.isArray(container.processes) ||
    !authority ||
    !isDeepStrictEqual(snapshot.identity, authority.runtimeIdentity) ||
    container.containerId !== authority.containerId ||
    container.cgroupNamespace !== authority.cgroupNamespace ||
    container.mountNamespace !== authority.mountNamespace ||
    container.userNamespace !== authority.userNamespace ||
    !isDeepStrictEqual(
      [...container.mounts].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
      mounts
    ) ||
    !isDeepStrictEqual(container.processes, [expectedProcess])
  )
    refuse();
  return snapshot;
}

export function assertNormalModeCleanState(snapshot) {
  return assertNormalRuntimeState(snapshot);
}
