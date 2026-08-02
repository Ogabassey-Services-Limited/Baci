import { createHash } from 'node:crypto';
import { registrationNetworkAuthority } from './registration-network-authority.fixture.mjs';

export const digest = (value = 'bound') =>
  createHash('sha256').update(value).digest('hex');

export const controllerContext = Object.freeze({
  campaignId: 'registration-01',
  captureSha256: digest('capture'),
  configureArgvSha256: digest('configure-argv'),
  imageDigest: `sha256:${'b'.repeat(64)}`,
  listenerExecutableSha256: digest('listener'),
  nodeArgvSha256: digest('node-argv'),
  nodeExecutableSha256: digest('node'),
  policyFileSha256: digest('policy'),
  registrationNonce: 'c'.repeat(32),
  releaseNonce: 'd'.repeat(32),
  stagingNonce: 'e'.repeat(32),
  phaseEnvironmentSha256: Object.freeze({
    'listener-configure': digest('env-listener-configure'),
    'node-ready': digest('env-node-ready'),
    'node-started': digest('env-node-started'),
    'node-token-absent': digest('env-node-token-absent'),
    'post-container': null,
    'pre-start': null,
  }),
});

export const observedAuthority = Object.freeze({
  cgroupNamespace: 'cgroup:[403]',
  containerId: 'a'.repeat(64),
  listenerPid: 4312,
  mountNamespace: 'mnt:[401]',
  parentIdentitySha256: digest('container-shim-parent'),
  runtimeIdentity: Object.freeze({
    cgroupAncestry: Object.freeze([
      '/sys/fs/cgroup',
      '/sys/fs/cgroup/cwv-measurement.slice',
      `/sys/fs/cgroup/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope`,
    ]),
    cgroupPath: `/sys/fs/cgroup/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope`,
    credentials: Object.freeze({
      effectiveGid: 10001,
      effectiveUid: 10001,
      realGid: 10001,
      realUid: 10001,
      savedGid: 10001,
      savedUid: 10001,
      supplementaryGroups: Object.freeze([10001]),
    }),
    namespaces: Object.freeze({
      cgroup: 'cgroup:[403]',
      mnt: 'mnt:[401]',
      user: 'user:[402]',
    }),
  }),
  userNamespace: 'user:[402]',
});

export const resourceContract = Object.freeze({
  cgroupParent: 'cwv-measurement.slice',
  cpusetCpus: '2-3',
  dockerSocket: 'unix:///run/baci-cwv/docker.sock',
  memoryBytes: 8589934592,
  memorySwapBytes: 0,
  networkAuthority: registrationNetworkAuthority,
  pidsLimit: 1024,
  runnerGid: 10001,
  runnerUid: 10001,
  shmBytes: 1073741824,
});

export function registrationSnapshot(phase, layout, patch = {}) {
  const node = {
    argvSha256: controllerContext.nodeArgvSha256,
    containerPid: 1,
    executableSha256: controllerContext.nodeExecutableSha256,
    parentIdentitySha256: digest('container-shim-parent'),
    pid: observedAuthority.listenerPid,
  };
  const listener = {
    argvSha256: controllerContext.configureArgvSha256,
    containerPid: 1,
    executableSha256: controllerContext.listenerExecutableSha256,
    parentIdentitySha256: digest('container-shim-parent'),
    pid: observedAuthority.listenerPid,
  };
  const pathRows = {
    'node-started': Object.values(layout),
    'node-ready': Object.values(layout),
    'node-token-absent': [layout.staging, layout.releaseParent, layout.handoff],
    'listener-configure': [
      layout.staging,
      layout.releaseParent,
      layout.handoff,
    ],
    'post-container': [layout.staging, layout.releaseParent, layout.handoff],
    'pre-start': [],
  };
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
  const allMounts = [
    mounts.policy,
    mounts.release,
    mounts.staging,
    mounts.token,
  ];
  const mountRows = {
    'node-started': allMounts,
    'node-ready': allMounts,
    'node-token-absent': allMounts,
    'listener-configure': allMounts,
  };
  const activeProcess = phase === 'listener-configure' ? listener : node;
  const running = mountRows[phase]
    ? [
        {
          cgroupNamespace: observedAuthority.cgroupNamespace,
          containerId: observedAuthority.containerId,
          mountNamespace: observedAuthority.mountNamespace,
          mounts: mountRows[phase],
          processes: [activeProcess],
          userNamespace: observedAuthority.userNamespace,
        },
      ]
    : [];
  return {
    artifacts: pathRows[phase],
    containers: running,
    egress: {
      bytes: 0,
      mode: phase === 'listener-configure' ? 'active' : 'default-drop',
      packets: 0,
    },
    environmentSha256: controllerContext.phaseEnvironmentSha256[phase],
    identity: running.length > 0 ? observedAuthority.runtimeIdentity : null,
    normalService: { active: false, enabled: false },
    schemaVersion: 1,
    ...patch,
  };
}

export function registrationExecutor(layout, options = {}) {
  const boundaries = [];
  const calls = [];
  const payloads = [];
  let published;
  let createdArgv;
  let failed = false;
  let retryBlocked = false;
  const occurrences = new Map();
  let tokenBytes;
  let tokenClearedBeforeStart;
  const execute = (operation, payload = {}) => {
    calls.push(operation);
    payloads.push([operation, payload]);
    if (operation === 'guard-registration') boundaries.push(payload.boundary);
    occurrences.set(operation, (occurrences.get(operation) ?? 0) + 1);
    if (
      operation === options.failAt &&
      !failed &&
      occurrences.get(operation) === (options.failAtOccurrence ?? 1)
    ) {
      failed = true;
      throw new Error('injected terminal failure');
    }
    if (operation === 'verify-prepared-transaction' && retryBlocked)
      throw new Error('retry block');
    if (operation === 'mark-registration-ambiguous') {
      retryBlocked = true;
      return {};
    }
    if (operation === 'inspect-registration') {
      const snapshot = registrationSnapshot(payload.phase, layout);
      return snapshot;
    }
    if (operation === 'create-registration-container') {
      createdArgv = payload.argv;
      return {
        containerId:
          options.createdContainerId ?? observedAuthority.containerId,
      };
    }
    if (operation === 'inspect-registration-config')
      return {
        containerId: options.configContainerId ?? observedAuthority.containerId,
        createArgvSha256:
          options.configArgvSha256 ?? digest(JSON.stringify(createdArgv)),
        imageDigest: options.configImageDigest ?? controllerContext.imageDigest,
      };
    if (operation === 'verify-default-drop')
      return { zeroCountersSha256: digest('zero-counters') };
    if (operation === 'wait-registration-ready')
      return { registrationReadySha256: digest('ready') };
    if (operation === 'unmount-token')
      return { tokenUnmountSha256: digest('token-unmount') };
    if (operation === 'delete-token-layout')
      return { tokenDeleteSha256: digest('token-delete') };
    if (operation === 'activate-registration-egress')
      return {
        activeEgressRuleSha256: digest('active-egress'),
        egressReleaseSha256: digest('egress-release'),
      };
    if (operation === 'prove-token-absence')
      return { tokenAbsenceSha256: digest('token-absence') };
    if (operation === 'monotonic-milliseconds') return { value: 1_000 };
    if (operation === 'publish-release-once') {
      published = payload;
      return { published: true };
    }
    if (operation === 'write-registration-token') tokenBytes = payload.bytes;
    if (operation === 'start-registration-container')
      tokenClearedBeforeStart = tokenBytes?.every((byte) => byte === 0);
    if (operation === 'wait-release-read-once')
      return { reads: 1, sha256: published.sha256 };
    if (operation === 'seal-runner')
      return {
        runnerIdentitySha256: digest('runner-identity'),
        sealedRunnerSha256: digest('sealed-runner'),
      };
    return {};
  };
  const readToken = () => {
    calls.push('read-token');
    return Buffer.from(`${'A'.repeat(29)}\n`);
  };
  return {
    boundaries,
    calls,
    dependencies: { execute, readToken },
    payloads,
    get published() {
      return published;
    },
    get tokenClearedBeforeStart() {
      return tokenClearedBeforeStart;
    },
  };
}
