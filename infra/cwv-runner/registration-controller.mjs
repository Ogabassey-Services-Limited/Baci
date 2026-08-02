import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { runRegistrationFlow } from './registration-controller-flow.mjs';
import * as controllerState from './registration-controller-state.mjs';

const NONCE = /^[a-f0-9]{32}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const TOKEN_READ = Object.freeze({
  maximumBytes: 129,
  timeoutMilliseconds: 10_000,
});

function fail(message = 'registration contract refused') {
  throw new TypeError(message);
}

function requireContext(context) {
  for (const forbidden of [
    'cgroupNamespace',
    'containerId',
    'listenerPid',
    'mountNamespace',
    'runtimeIdentity',
    'userNamespace',
  ])
    if (forbidden in (context ?? {})) fail('registration identity refused');
  for (const key of [
    'captureSha256',
    'configureArgvSha256',
    'listenerExecutableSha256',
    'nodeArgvSha256',
    'nodeExecutableSha256',
    'policyFileSha256',
  ])
    if (!SHA256.test(context?.[key])) fail('registration identity refused');
  for (const key of ['registrationNonce', 'releaseNonce', 'stagingNonce'])
    if (!NONCE.test(context?.[key])) fail('registration nonce refused');
  if (
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(context?.campaignId) ||
    !IMAGE.test(context?.imageDigest) ||
    !exactKeys(context?.phaseEnvironmentSha256, [
      'listener-configure',
      'node-ready',
      'node-started',
      'node-token-absent',
      'post-container',
      'pre-start',
    ]) ||
    // biome-ignore format: closed phase hash keys preserve the file size cap
    !['listener-configure', 'node-ready', 'node-started', 'node-token-absent'].every(
      (key) => SHA256.test(context.phaseEnvironmentSha256[key])
    ) ||
    context.phaseEnvironmentSha256['post-container'] !== null ||
    context.phaseEnvironmentSha256['pre-start'] !== null
  )
    fail('registration identity refused');
  return context;
}

export function registrationLayout(context) {
  requireContext(context);
  const tokenRoot = `/run/baci-cwv-registration/${context.registrationNonce}`;
  const releaseRoot = `/run/baci-cwv-registration-release/${context.releaseNonce}`;
  return Object.freeze({
    handoff: {
      gid: 10001,
      mode: 0o750,
      path: `${releaseRoot}/handoff`,
      type: 'directory',
      uid: 0,
    },
    releaseParent: {
      gid: 0,
      mode: 0o700,
      path: releaseRoot,
      type: 'directory',
      uid: 0,
    },
    staging: {
      gid: 10001,
      mode: 0o700,
      path: `/srv/baci-cwv/registration-staging/${context.stagingNonce}`,
      type: 'directory',
      uid: 10001,
    },
    token: {
      gid: 10001,
      mode: 0o440,
      path: `${tokenRoot}/token`,
      tmpfs: true,
      type: 'file',
      uid: 0,
    },
    tokenParent: {
      gid: 0,
      mode: 0o700,
      path: tokenRoot,
      tmpfs: true,
      type: 'directory',
      uid: 0,
    },
  });
}

export async function readRegistrationToken(read, timers = {}) {
  if (typeof read !== 'function') fail('token reader refused');
  const schedule = timers.setTimeout ?? globalThis.setTimeout;
  const cancel = timers.clearTimeout ?? globalThis.clearTimeout;
  if (typeof schedule !== 'function' || typeof cancel !== 'function')
    fail('token timer refused');
  const controller = new AbortController();
  let expired = false;
  const reader = Promise.resolve().then(() =>
    read({ ...TOKEN_READ, signal: controller.signal })
  );
  reader.then(
    (late) => {
      if (expired && Buffer.isBuffer(late)) late.fill(0);
    },
    () => undefined
  );
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = schedule(
      () => reject(new TypeError('registration token refused')),
      TOKEN_READ.timeoutMilliseconds
    );
  });
  let bytes;
  try {
    bytes = await Promise.race([reader, timeout]);
  } finally {
    expired = true;
    controller.abort();
    cancel(timer);
  }
  if (!Buffer.isBuffer(bytes)) fail('registration token refused');
  let accepted = false;
  try {
    if (
      bytes.length < 21 ||
      bytes.length > TOKEN_READ.maximumBytes ||
      bytes.at(-1) !== 10 ||
      bytes
        .subarray(0, -1)
        .some(
          (byte) =>
            !(
              (byte >= 48 && byte <= 57) ||
              (byte >= 65 && byte <= 90) ||
              (byte >= 97 && byte <= 122)
            )
        )
    )
      fail('registration token refused');
    accepted = true;
    return bytes;
  } finally {
    if (!accepted) bytes.fill(0);
  }
}

function requireResources(resources) {
  if (
    resources?.dockerSocket !== 'unix:///run/baci-cwv/docker.sock' ||
    resources.cgroupParent !== 'cwv-measurement.slice' ||
    resources.cpusetCpus !== '2-3' ||
    !Number.isSafeInteger(resources.memoryBytes) ||
    resources.memoryBytes <= 0 ||
    !Number.isSafeInteger(resources.memorySwapBytes) ||
    resources.memorySwapBytes < 0 ||
    !Number.isSafeInteger(resources.memoryBytes + resources.memorySwapBytes) ||
    resources.pidsLimit !== 1024 ||
    resources.shmBytes !== 1073741824 ||
    resources.runnerUid !== 10001 ||
    resources.runnerGid !== 10001
  )
    fail('registration resources refused');
}

export function registrationContainerArgv(context, resources) {
  requireContext(context);
  requireResources(resources);
  const layout = registrationLayout(context);
  return [
    '/usr/bin/docker',
    `--host=${resources.dockerSocket}`,
    'create',
    '--pull=never',
    `--name=baci-cwv-registration-${context.registrationNonce}`,
    `--label=baci.cwv.transaction=${context.campaignId}`,
    '--network=baci-cwv-net',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges=true',
    `--cgroup-parent=${resources.cgroupParent}`,
    `--cpuset-cpus=${resources.cpusetCpus}`,
    `--memory=${resources.memoryBytes}b`,
    `--memory-swap=${resources.memoryBytes + resources.memorySwapBytes}b`,
    `--pids-limit=${resources.pidsLimit}`,
    `--shm-size=${resources.shmBytes}`,
    '--user=10001:10001',
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=1777',
    '--tmpfs=/home/runner:rw,noexec,nosuid,nodev,size=16777216,mode=700',
    `--volume=${layout.token.path}:/run/secrets/runner-registration-token:ro`,
    `--volume=${layout.staging.path}:/registration-staging:rw`,
    '--volume=/srv/baci-cwv/sealed/policy.sha256:/run/baci-cwv-policy/policy.sha256:ro',
    `--volume=${layout.handoff.path}:/run/baci-cwv-registration-release:ro`,
    `--env=BACI_CWV_CAMPAIGN_ID=${context.campaignId}`,
    `--env=BACI_CWV_CAPTURE_SHA256=${context.captureSha256}`,
    `--env=BACI_CWV_IMAGE_DIGEST=${context.imageDigest}`,
    `--env=BACI_CWV_REGISTRATION_NONCE=${context.registrationNonce}`,
    '--entrypoint=/opt/node/bin/node',
    context.imageDigest,
    '/opt/baci-cwv/entrypoint.mjs',
    '--mode',
    'registration',
  ];
}

export function validateRegistrationContainerArgv(argv, context, resources) {
  const expected = registrationContainerArgv(context, resources);
  if (!Array.isArray(argv) || !isDeepStrictEqual(argv, expected))
    fail('registration argv refused');
  return Object.freeze([...argv]);
}

export function validateRegistrationSnapshot(
  snapshot,
  phase,
  context,
  authority
) {
  requireContext(context);
  return controllerState.validateRegistrationSnapshotState(
    snapshot,
    phase,
    context,
    registrationLayout(context),
    authority
  );
}

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());

function validateCreatedContainer(value) {
  if (
    !exactKeys(value, ['containerId']) ||
    !/^[a-f0-9]{64}$/.test(value.containerId)
  )
    fail('registration create refused');
  return value.containerId;
}

function validateCreatedConfig(value, containerId, argv, context) {
  const createArgvSha256 = createHash('sha256')
    .update(JSON.stringify(argv))
    .digest('hex');
  if (
    !exactKeys(value, ['containerId', 'createArgvSha256', 'imageDigest']) ||
    value.containerId !== containerId ||
    value.createArgvSha256 !== createArgvSha256 ||
    value.imageDigest !== context.imageDigest
  )
    fail('registration create config refused');
}

export function assertNormalModeClean(snapshot) {
  return controllerState.assertNormalModeCleanState(snapshot);
}

export function runRegistrationController(context, resources, dependencies) {
  const layout = registrationLayout(context);
  const argv = registrationContainerArgv(context, resources);
  return runRegistrationFlow(context, dependencies, {
    argv,
    layout,
    observe: controllerState.observeRegistrationIdentity,
    readToken: readRegistrationToken,
    validate: (snapshot, phase, authority) =>
      validateRegistrationSnapshot(snapshot, phase, context, authority),
    validateCreated: validateCreatedContainer,
    validateCreatedConfig: (value, containerId) =>
      validateCreatedConfig(value, containerId, argv, context),
  });
}
