import { isDeepStrictEqual } from 'node:util';

import { canonicalJson } from './canonical-json.mjs';
import {
  readCompletedRegistrationCommand,
  readRegistrationCommandIfPresent,
} from './registration-command-store.mjs';

const HASH = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const NONCE = /^[a-f0-9]{32}$/;
const CIDR =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(?:[0-9]|[12]\d|3[0-2])$/;
const fail = () => {
  throw new TypeError('registration root configuration refused');
};
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sortedUnique = (value, compare = undefined) =>
  Array.isArray(value) &&
  new Set(value).size === value.length &&
  value.every(
    (item, index) =>
      index === 0 ||
      (compare ? compare(value[index - 1], item) < 0 : value[index - 1] < item)
  );

function validNetworkAuthority(value) {
  return (
    exact(value, [
      'deniedDestinationCidrs',
      'expectedEgressPlanSha256',
      'externalIfindex',
      'externalInterface',
      'nonrootServiceUids',
    ]) &&
    /^[A-Za-z0-9_.-]{1,15}$/.test(value.externalInterface) &&
    Number.isSafeInteger(value.externalIfindex) &&
    value.externalIfindex > 0 &&
    HASH.test(value.expectedEgressPlanSha256) &&
    sortedUnique(value.deniedDestinationCidrs) &&
    value.deniedDestinationCidrs.length > 0 &&
    value.deniedDestinationCidrs.every(
      (item) => typeof item === 'string' && CIDR.test(item)
    ) &&
    sortedUnique(value.nonrootServiceUids, (left, right) => left - right) &&
    value.nonrootServiceUids.length > 0 &&
    value.nonrootServiceUids.every(
      (item) => Number.isSafeInteger(item) && item > 0
    )
  );
}

function valid(value) {
  const context = value?.context;
  const resources = value?.resources;
  const phases = context?.phaseEnvironmentSha256;
  return (
    exact(value, ['context', 'resources', 'schemaVersion']) &&
    value.schemaVersion === 2 &&
    exact(context, [
      'campaignId',
      'captureSha256',
      'configureArgvSha256',
      'imageDigest',
      'listenerExecutableSha256',
      'nodeArgvSha256',
      'nodeExecutableSha256',
      'phaseEnvironmentSha256',
      'policyFileSha256',
      'registrationNonce',
      'releaseNonce',
      'stagingNonce',
    ]) &&
    /^[a-z0-9][a-z0-9-]{0,62}$/.test(context.campaignId) &&
    IMAGE.test(context.imageDigest) &&
    [
      'captureSha256',
      'configureArgvSha256',
      'listenerExecutableSha256',
      'nodeArgvSha256',
      'nodeExecutableSha256',
      'policyFileSha256',
    ].every((key) => HASH.test(context[key])) &&
    ['registrationNonce', 'releaseNonce', 'stagingNonce'].every((key) =>
      NONCE.test(context[key])
    ) &&
    new Set([
      context.registrationNonce,
      context.releaseNonce,
      context.stagingNonce,
    ]).size === 3 &&
    exact(phases, [
      'listener-configure',
      'node-ready',
      'node-started',
      'node-token-absent',
      'post-container',
      'pre-start',
    ]) &&
    [
      'listener-configure',
      'node-ready',
      'node-started',
      'node-token-absent',
    ].every((key) => HASH.test(phases[key])) &&
    phases['post-container'] === null &&
    phases['pre-start'] === null &&
    exact(resources, [
      'cgroupParent',
      'cpusetCpus',
      'dockerSocket',
      'memoryBytes',
      'memorySwapBytes',
      'networkAuthority',
      'pidsLimit',
      'runnerGid',
      'runnerUid',
      'shmBytes',
    ]) &&
    resources.cgroupParent === 'cwv-measurement.slice' &&
    resources.cpusetCpus === '2-3' &&
    resources.dockerSocket === 'unix:///run/baci-cwv/docker.sock' &&
    Number.isSafeInteger(resources.memoryBytes) &&
    resources.memoryBytes > 0 &&
    Number.isSafeInteger(resources.memorySwapBytes) &&
    resources.memorySwapBytes >= 0 &&
    Number.isSafeInteger(resources.pidsLimit) &&
    resources.pidsLimit > 0 &&
    Number.isSafeInteger(resources.runnerUid) &&
    resources.runnerUid > 0 &&
    Number.isSafeInteger(resources.runnerGid) &&
    resources.runnerGid > 0 &&
    Number.isSafeInteger(resources.shmBytes) &&
    resources.shmBytes > 0 &&
    validNetworkAuthority(resources.networkAuthority)
  );
}

export function parseRegistrationRootConfiguration(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > 16_384)
    fail();
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (!valid(value) || canonicalJson(value) !== bytes.toString('utf8')) fail();
  return value;
}

export function serializeRegistrationRootConfiguration(value) {
  if (!valid(value)) fail();
  return Buffer.from(canonicalJson(value), 'utf8');
}

export async function readRegistrationRootConfiguration(dependencies = {}) {
  if (
    dependencies === null ||
    typeof dependencies !== 'object' ||
    Array.isArray(dependencies)
  )
    fail();
  const active = await readRegistrationCommandIfPresent(dependencies);
  return parseRegistrationRootConfiguration(
    active ?? (await readCompletedRegistrationCommand(dependencies))
  );
}
