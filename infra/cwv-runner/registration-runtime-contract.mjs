import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { canonicalJson } from './canonical-json.mjs';
import { validateImageProcessMap } from './image-process-map.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const HASH = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const NONCE = /^[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const CIDR =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(?:[0-9]|[12]\d|3[0-2])$/;
const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
// biome-ignore format: sealed terminal error remains intentionally compact.
const fail = () => { throw new TypeError('registration runtime contract refused'); };
const digest = (value) => createHash('sha256').update(value).digest('hex');
// biome-ignore format: closed key equality remains intentionally compact.
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const freeze = (value) => Object.freeze(value);

// biome-ignore format: sealed argv bytes remain deliberately compact.
export const registrationNodeArgv = () => freeze(['/opt/node/bin/node', '/opt/baci-cwv/entrypoint.mjs', '--mode', 'registration']);
// biome-ignore format: the exact policy-derived configure tuple is a sealed contract.
export function registrationConfigureArgv(policy) {
  const defaults = ['self-hosted', 'Linux', 'X64'];
  const labels = policy?.runner?.labels;
  if (!Array.isArray(labels) || !defaults.every((label) => labels.filter((value) => value === label).length === 1)) fail();
  const custom = labels.filter((label) => !defaults.includes(label));
  if (custom.length !== 1 || custom[0] !== 'baci-cwv-measurement' || typeof policy?.repository?.name !== 'string' || typeof policy.runner.name !== 'string') fail();
  return freeze(['/registration-staging/actions-runner/bin/Runner.Listener', 'configure', '--unattended', '--url', `https://github.com/${policy.repository.name}`, '--name', policy.runner.name, '--labels', custom[0], '--work', '/runner-work', '--disableupdate']);
}

function phaseEnvironment(phase) {
  if (['pre-start', 'post-container'].includes(phase)) return null;
  return freeze({
    BACI_CWV_REGISTRATION_MODE: '1',
    ...(phase === 'listener-configure'
      ? { BACI_CWV_REGISTRATION_PHASE: 'configure' }
      : {}),
  });
}

function canonicalObject(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 131_072)
    fail();
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (canonicalJson(value) !== bytes.toString('utf8')) fail();
  return value;
}

function capture(bytes) {
  const value = canonicalObject(bytes);
  if (
    !exact(value, [
      'expectedEgressPlan',
      'externalIfindex',
      'externalInterface',
      'hostIpv4Addresses',
      'nonrootServiceUids',
      'productionDockerSubnets',
    ]) ||
    !/^[A-Za-z0-9_.-]{1,15}$/.test(value.externalInterface) ||
    !Number.isSafeInteger(value.externalIfindex) ||
    value.externalIfindex < 1 ||
    !Array.isArray(value.hostIpv4Addresses) ||
    !Array.isArray(value.productionDockerSubnets) ||
    !Array.isArray(value.nonrootServiceUids) ||
    !value.hostIpv4Addresses.every(
      (item) => typeof item === 'string' && IPV4.test(item)
    ) ||
    !value.productionDockerSubnets.every(
      (item) => typeof item === 'string' && CIDR.test(item)
    ) ||
    !value.nonrootServiceUids.every(
      (item) => Number.isSafeInteger(item) && item > 0
    )
  )
    fail();
  return value;
}

function runtime(bytes, imageReceipt) {
  const value = canonicalObject(bytes);
  if (
    !exact(value, ['executables', 'imageId', 'schemaVersion']) ||
    value.schemaVersion !== 1 ||
    value.imageId !== imageReceipt.imageId ||
    !exact(value.executables, ['listener', 'node'])
  )
    fail();
  for (const [name, path] of [
    ['node', '/opt/node/bin/node'],
    ['listener', '/opt/runner/bin/Runner.Listener'],
  ]) {
    const executable = value.executables[name];
    if (
      !exact(executable, ['path', 'sha256']) ||
      executable.path !== path ||
      !HASH.test(executable.sha256)
    )
      fail();
    const mapped = imageReceipt.processMap.entries.find(
      (row) => row.path === path
    );
    if (!mapped || mapped.sha256 !== executable.sha256) fail();
  }
  return value;
}

function campaignAuthority(bytes) {
  const value = canonicalObject(bytes);
  if (
    !exact(value, [
      'campaignId',
      'registrationNonce',
      'releaseNonce',
      'schemaVersion',
      'stagingNonce',
    ]) ||
    value.schemaVersion !== 1 ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.campaignId) ||
    !['registrationNonce', 'releaseNonce', 'stagingNonce'].every((key) =>
      NONCE.test(value[key])
    ) ||
    new Set([value.registrationNonce, value.releaseNonce, value.stagingNonce])
      .size !== 3
  )
    fail();
  return value;
}

// biome-ignore format: receipt inputs remain an ordered sealed tuple.
function configuration(campaignBytes, policyBytes, captureBytes, imageBytes, runtimeBytes) {
  const campaign = campaignAuthority(campaignBytes);
  if (
    !Buffer.isBuffer(policyBytes) ||
    policyBytes.length === 0 ||
    policyBytes.length > 131_072
  )
    fail();
  let rawPolicy;
  try {
    rawPolicy = JSON.parse(policyBytes.toString('utf8'));
  } catch {
    fail();
  }
  let parsedPolicy;
  try {
    parsedPolicy = parseRunnerPolicy(rawPolicy);
  } catch {
    fail();
  }
  const imageReceipt = canonicalObject(imageBytes);
  if (
    !IMAGE.test(imageReceipt.imageId) ||
    imageReceipt.policyFileSha256 !== digest(policyBytes) ||
    !imageReceipt.processMap
  )
    fail();
  validateImageProcessMap(imageReceipt.processMap, parsedPolicy);
  const verifiedCapture = capture(captureBytes);
  const verifiedRuntime = runtime(runtimeBytes, imageReceipt);
  const denied = [
    ...new Set([
      ...parsedPolicy.dedicatedRuntime.deniedDestinationCidrs,
      ...verifiedCapture.hostIpv4Addresses.map((address) => `${address}/32`),
      ...verifiedCapture.productionDockerSubnets,
    ]),
  ].sort();
  if (!denied.every((value) => CIDR.test(value))) fail();
  const environments = Object.fromEntries(
    [
      'listener-configure',
      'node-ready',
      'node-started',
      'node-token-absent',
      'post-container',
      'pre-start',
    ].map((phase) => {
      const value = phaseEnvironment(phase);
      return [phase, value === null ? null : digest(canonicalJson(value))];
    })
  );
  return {
    context: {
      campaignId: campaign.campaignId,
      captureSha256: digest(captureBytes),
      configureArgvSha256: digest(
        canonicalJson(registrationConfigureArgv(parsedPolicy))
      ),
      imageDigest: imageReceipt.imageId,
      listenerExecutableSha256: verifiedRuntime.executables.listener.sha256,
      nodeArgvSha256: digest(canonicalJson(registrationNodeArgv())),
      nodeExecutableSha256: verifiedRuntime.executables.node.sha256,
      phaseEnvironmentSha256: environments,
      policyFileSha256: digest(policyBytes),
      registrationNonce: campaign.registrationNonce,
      releaseNonce: campaign.releaseNonce,
      stagingNonce: campaign.stagingNonce,
    },
    resources: {
      cgroupParent: 'cwv-measurement.slice',
      cpusetCpus: parsedPolicy.resources.measurementCpuSet,
      dockerSocket: `unix://${parsedPolicy.dedicatedRuntime.dockerSocket}`,
      memoryBytes: parsedPolicy.resources.memoryBytes,
      memorySwapBytes: parsedPolicy.resources.memorySwapBytes,
      networkAuthority: {
        deniedDestinationCidrs: denied,
        expectedEgressPlanSha256: digest(
          canonicalJson(verifiedCapture.expectedEgressPlan)
        ),
        externalIfindex: verifiedCapture.externalIfindex,
        externalInterface: verifiedCapture.externalInterface,
        nonrootServiceUids: [
          ...new Set([
            ...verifiedCapture.nonrootServiceUids,
            parsedPolicy.host.runnerUid,
          ]),
        ].sort((left, right) => left - right),
      },
      pidsLimit: parsedPolicy.resources.pidsLimit,
      runnerGid: parsedPolicy.host.runnerGid,
      runnerUid: parsedPolicy.host.runnerUid,
      shmBytes: parsedPolicy.resources.shmBytes,
    },
    schemaVersion: 2,
  };
}

export async function prepareRegistrationRuntimeContract(dependencies = {}) {
  const readers = [
    'readCampaign',
    'readCapture',
    'readImageReceipt',
    'readPolicy',
    'readRuntimeReceipt',
  ];
  if (
    !exact(dependencies, readers) ||
    !readers.every((name) => typeof dependencies[name] === 'function')
  )
    fail();
  try {
    const [campaignBytes, captureBytes, imageBytes, policyBytes, runtimeBytes] =
      await Promise.all(readers.map((name) => dependencies[name]()));
    return freeze(
      configuration(
        campaignBytes,
        policyBytes,
        captureBytes,
        imageBytes,
        runtimeBytes
      )
    );
  } catch {
    fail();
  }
}

export function createRegistrationRuntimeAuthority(dependencies = {}) {
  const entropy = dependencies.randomBytes ?? randomBytes;
  const uuid = dependencies.randomUuid ?? randomUUID;
  if (
    !Object.keys(dependencies).every((key) =>
      ['randomBytes', 'randomUuid'].includes(key)
    ) ||
    !['randomBytes', 'randomUuid'].every(
      (key) => !(key in dependencies) || typeof dependencies[key] === 'function'
    ) ||
    typeof entropy !== 'function' ||
    typeof uuid !== 'function'
  )
    fail();
  const campaignId = `registration-${uuid()}`;
  const nonces = [entropy(16), entropy(16), entropy(16)].map((value) => {
    if (!Buffer.isBuffer(value) || value.length !== 16) fail();
    return value.toString('hex');
  });
  if (
    !UUID.test(campaignId.slice('registration-'.length)) ||
    new Set(nonces).size !== 3
  )
    fail();
  return freeze({
    campaignId,
    registrationNonce: nonces[0],
    releaseNonce: nonces[1],
    schemaVersion: 1,
    stagingNonce: nonces[2],
  });
}
