import { isDeepStrictEqual } from 'node:util';
import { canonicalJson, sha256 } from './campaign-state.mjs';

const SHA256_LINE = /^[a-f0-9]{64}\n$/;
const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const runtimeKeys = [
  'chrome',
  'imageId',
  'node',
  'pnpm',
  'runtimeRunner',
  'runtimeRunnerBinaryDigest',
  'schemaVersion',
];

function fail(message) {
  throw new TypeError(message);
}

function safeCanonical(value, message) {
  try {
    return canonicalJson(value);
  } catch {
    fail(message);
  }
}

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort())
  );
}

const credentialValue =
  /ghp_|ghs_|github_pat_|cfat_|AKIA[0-9A-Z]{16}|bearer[ \t]|token=|secret|credential|password|private.?key|api.?key/i;
const credentialKey =
  /token|key|secret|credential|password|authorization|cookie/i;

export function containsRuntimeCredential(value) {
  if (typeof value === 'string') return credentialValue.test(value);
  if (Array.isArray(value)) return value.some(containsRuntimeCredential);
  if (value && typeof value === 'object')
    return Object.entries(value).some(
      ([key, nested]) =>
        credentialKey.test(key) || containsRuntimeCredential(nested)
    );
  return false;
}

function requireContract(context, resources) {
  if (
    !ID.test(context?.campaignId) ||
    !/^sha256:[a-f0-9]{64}$/.test(context?.imageDigest)
  )
    fail('probe identity refused');
  if (
    !resources ||
    Object.keys(resources).sort().join(',') !==
      'cgroupParent,cpusetCpus,dockerSocket,memoryBytes,memorySwapBytes,networkAuthority,pidsLimit,runnerGid,runnerUid,shmBytes' ||
    resources.dockerSocket !== 'unix:///run/baci-cwv/docker.sock' ||
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
    resources.runnerGid !== 10001 ||
    !resources.networkAuthority ||
    Object.keys(resources.networkAuthority).sort().join(',') !==
      'deniedDestinationCidrs,expectedEgressPlanSha256,externalIfindex,externalInterface,nonrootServiceUids' ||
    !/^[a-f0-9]{64}$/.test(resources.networkAuthority.expectedEgressPlanSha256)
  )
    fail('probe resources refused');
}

export function isolationProbeArgv(context, resources) {
  requireContract(context, resources);
  return [
    '/usr/bin/docker',
    `--host=${resources.dockerSocket}`,
    'run',
    '--pull=never',
    '--rm',
    `--name=baci-cwv-isolation-${context.campaignId}`,
    '--network=none',
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
    '--entrypoint=/opt/baci-cwv/isolation-probe.sh',
    context.imageDigest,
  ];
}

export function validateIsolationProbeArgv(argv, context, resources) {
  const expected = isolationProbeArgv(context, resources);
  if (!Array.isArray(argv) || !isDeepStrictEqual(argv, expected))
    fail('isolation probe argv refused');
  return Object.freeze([...argv]);
}

export async function runIsolationProbe(context, resources, execute) {
  if (typeof execute !== 'function') fail('probe executor refused');
  const raw = await execute(isolationProbeArgv(context, resources));
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    fail('isolation probe refused');
  }
  const keys = [
    'cgroup',
    'cpuset',
    'gid',
    'readOnlyRoot',
    'resources',
    'shm',
    'uid',
  ];
  if (
    raw !== `${safeCanonical(receipt, 'isolation probe refused')}\n` ||
    !exactKeys(receipt, keys) ||
    !keys.every((key) => receipt[key] === true)
  )
    fail('isolation probe refused');
  return Object.freeze({
    campaignId: context.campaignId,
    imageDigest: context.imageDigest,
    result: Object.freeze(receipt),
    schemaVersion: 1,
    sha256: sha256(canonicalJson(receipt)),
  });
}

export function runtimeIdentityProbeArgv(context, resources) {
  requireContract(context, resources);
  return [
    '/usr/bin/docker',
    `--host=${resources.dockerSocket}`,
    'run',
    '--pull=never',
    '--rm',
    `--name=baci-cwv-runtime-identity-${context.campaignId}`,
    '--network=none',
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
    '--volume=/srv/baci-cwv/sealed/runtime-runner-binaries:/opt/runner:ro',
    '--entrypoint=/opt/node/bin/node',
    context.imageDigest,
    '/opt/baci-cwv/container-attest-runtime.mjs',
    '/',
    context.imageDigest,
  ];
}

export function validateRuntimeIdentityProbeArgv(argv, context, resources) {
  const expected = runtimeIdentityProbeArgv(context, resources);
  if (!Array.isArray(argv) || !isDeepStrictEqual(argv, expected))
    fail('runtime identity argv refused');
  return Object.freeze([...argv]);
}

function validRuntimeIdentity(identity, expectedImage) {
  const hash = (value) => /^[a-f0-9]{64}$/.test(value ?? '');
  const versioned = (value, keys, version) =>
    exactKeys(value, keys) && value.version === version;
  const runnerPaths = [
    'bin/Runner.Listener',
    'bin/Runner.Worker',
    'entrypoint.mjs',
  ];
  const runnerFiles = identity?.runtimeRunner?.files;
  return (
    exactKeys(identity, runtimeKeys) &&
    identity.schemaVersion === 1 &&
    identity.imageId === expectedImage &&
    versioned(
      identity.chrome,
      ['binarySha256', 'debianPackage', 'debianSha256', 'version'],
      '150.0.7871.128'
    ) &&
    exactKeys(identity.chrome.debianPackage, [
      'architecture',
      'name',
      'version',
    ]) &&
    isDeepStrictEqual(identity.chrome.debianPackage, {
      architecture: 'amd64',
      name: 'google-chrome-stable',
      version: '150.0.7871.128-1',
    }) &&
    hash(identity.chrome.binarySha256) &&
    identity.chrome.debianSha256 ===
      '83ed59c85878ebb8fa53915ebe7066cafc58d1c04c1c95449486e6f9d99a1efb' &&
    versioned(identity.node, ['binarySha256', 'version'], '24.18.0') &&
    hash(identity.node.binarySha256) &&
    versioned(
      identity.pnpm,
      ['binarySha256', 'packageJsonSha256', 'packageProjection', 'version'],
      '11.7.0'
    ) &&
    exactKeys(identity.pnpm.packageProjection, ['bin', 'name', 'version']) &&
    isDeepStrictEqual(identity.pnpm.packageProjection, {
      bin: 'bin/pnpm.cjs',
      name: 'pnpm',
      version: '11.7.0',
    }) &&
    hash(identity.pnpm.binarySha256) &&
    hash(identity.pnpm.packageJsonSha256) &&
    exactKeys(identity.runtimeRunner, ['files', 'version']) &&
    identity.runtimeRunner.version === '2.335.1' &&
    Array.isArray(runnerFiles) &&
    runnerFiles.length === runnerPaths.length &&
    runnerFiles.every(
      (file, index) =>
        exactKeys(file, ['path', 'sha256']) &&
        file.path === runnerPaths[index] &&
        hash(file.sha256)
    ) &&
    hash(identity.runtimeRunnerBinaryDigest) &&
    identity.runtimeRunnerBinaryDigest ===
      sha256(canonicalJson(identity.runtimeRunner)) &&
    !containsRuntimeCredential(identity)
  );
}

export async function runRuntimeIdentityProbe(context, resources, execute) {
  if (typeof execute !== 'function') fail('runtime identity executor refused');
  const raw = await execute(runtimeIdentityProbeArgv(context, resources));
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    fail('runtime identity refused');
  }
  if (
    raw !== `${safeCanonical(envelope, 'runtime identity refused')}\n` ||
    !exactKeys(envelope, [
      'canonical',
      'owner',
      'schemaVersion',
      'sha256Receipt',
      'source',
    ]) ||
    envelope.schemaVersion !== 1 ||
    envelope.source !== 'runtime' ||
    !exactKeys(envelope.owner, ['gid', 'mode', 'uid']) ||
    envelope.owner.uid !== 0 ||
    envelope.owner.gid !== 10001 ||
    envelope.owner.mode !== '0640' ||
    typeof envelope.canonical !== 'string' ||
    !SHA256_LINE.test(envelope.sha256Receipt) ||
    sha256(envelope.canonical) !== envelope.sha256Receipt.slice(0, -1)
  )
    fail('runtime identity refused');
  let identity;
  try {
    identity = JSON.parse(envelope.canonical);
  } catch {
    fail('runtime identity refused');
  }
  if (
    safeCanonical(identity, 'runtime identity refused') !==
      envelope.canonical ||
    !validRuntimeIdentity(identity, context.imageDigest)
  )
    fail('runtime identity refused');
  return Object.freeze({
    canonical: envelope.canonical,
    envelope: Object.freeze(envelope),
    sha256: envelope.sha256Receipt.slice(0, -1),
  });
}
