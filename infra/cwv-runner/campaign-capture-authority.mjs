import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { canonicalJson } from './canonical-json.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

// biome-ignore format: keeps the capture module below the sealed source ceiling.
const AUTHORITY_FIELDS = Object.freeze('expectedEgressPlan externalIfindex externalInterface hostIpv4Addresses nonrootServiceUids productionDockerSubnets'.split(' '));
// biome-ignore format: keeps the capture module below the sealed source ceiling.
const EVIDENCE_FIELDS = Object.freeze('addresses dockerNetworks schemaVersion services'.split(' '));
const CIDR =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(?:[0-9]|[12]\d|3[0-2])$/;
const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const INTERFACE = /^[A-Za-z0-9_.-]{1,15}$/;
const UNIT = /^[A-Za-z0-9@_.-]+\.service$/;
const fail = () => {
  throw new TypeError('authority capture refused');
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const sorted = (values, compare = undefined) =>
  values.every(
    (value, index) =>
      index === 0 ||
      (compare
        ? compare(values[index - 1], value) < 0
        : values[index - 1] < value)
  );

// biome-ignore format: keeps the capture module below the sealed source ceiling.
function sealedPolicy() {
  try {
    return parseRunnerPolicy(
      JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
    );
  } catch {
    fail();
  }
}

function jsonValues(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 131_072)
    fail();
  const source = bytes.toString('utf8');
  const values = [];
  let offset = 0;
  while (offset < source.length) {
    while (/\s/.test(source[offset] ?? '')) offset += 1;
    if (offset === source.length) break;
    if (!['[', '{'].includes(source[offset])) fail();
    const start = offset;
    let depth = 0;
    let quote = false;
    let escaped = false;
    for (; offset < source.length; offset += 1) {
      const character = source[offset];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quote = false;
        continue;
      }
      if (character === '"') quote = true;
      else if (character === '[' || character === '{') depth += 1;
      else if (character === ']' || character === '}') {
        depth -= 1;
        if (depth === 0) {
          offset += 1;
          break;
        }
        if (depth < 0) fail();
      }
    }
    if (quote || depth !== 0) fail();
    try {
      values.push(JSON.parse(source.slice(start, offset)));
    } catch {
      fail();
    }
  }
  if (values.length === 0) fail();
  return values;
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
function hostIpv4Addresses(bytes) {
  const values = jsonValues(bytes);
  if (values.length !== 1 || !Array.isArray(values[0])) fail();
  const addresses = values[0].flatMap((link) =>
    Array.isArray(link?.addr_info)
      ? link.addr_info
          .filter((address) => address?.family === 'inet')
          .map((address) => address.local)
      : []
  );
  if (
    addresses.length === 0 ||
    !addresses.every((address) => typeof address === 'string' && IPV4.test(address)) ||
    new Set(addresses).size !== addresses.length
  )
    fail();
  return addresses.sort();
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
function productionDockerSubnets(bytes) {
  const networks = jsonValues(bytes).flat();
  const subnets = networks.flatMap((network) =>
    Array.isArray(network?.IPAM?.Config)
      ? network.IPAM.Config.map((config) => config?.Subnet).filter(Boolean)
      : []
  );
  if (
    subnets.length === 0 ||
    !subnets.every((subnet) => typeof subnet === 'string' && CIDR.test(subnet)) ||
    new Set(subnets).size !== subnets.length
  )
    fail();
  return subnets.sort();
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
function nonrootServiceUids(services) {
  if (!Array.isArray(services) || services.length === 0) fail();
  if (
    !services.every(
      (service) =>
        exact(service, ['uid', 'unit']) &&
        UNIT.test(service.unit) &&
        Number.isSafeInteger(service.uid) &&
        service.uid >= 0
    ) ||
    !sorted(services.map((service) => service.unit)) ||
    new Set(services.map((service) => service.unit)).size !== services.length
  )
    fail();
  const uids = [...new Set(services.map((service) => service.uid).filter(Boolean))];
  if (uids.length === 0) fail();
  return uids.sort((left, right) => left - right);
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
function expectedEgressPlan(externalInterface, deniedDestinationCidrs, runtime) {
  const { bridgeName: bridge, gateway, subnet } = runtime;
  const source = ['-i', bridge, '-s', subnet];
  const outside = ['-i', bridge, '!', '-s', subnet, '-j', 'REJECT'];
  const reject = ['-j', 'REJECT'];
  return {
    forward: [
      outside,
      ...[`${gateway}/32`, ...deniedDestinationCidrs].map((cidr) => [
        ...source,
        '-d',
        cidr,
        ...reject,
      ]),
      ...['udp', 'tcp'].map((protocol) => [
        ...source,
        '-o',
        externalInterface,
        '-p',
        protocol,
        '--dport',
        '53',
        '-j',
        'ACCEPT',
      ]),
      [...source, '-o', externalInterface, '-p', 'tcp', '--dport', '443', '-j', 'ACCEPT'],
      [
        '-i',
        externalInterface,
        '-o',
        bridge,
        '-d',
        subnet,
        '-m',
        'conntrack',
        '--ctstate',
        'ESTABLISHED,RELATED',
        '-j',
        'ACCEPT',
      ],
      ['-i', bridge, '-j', 'REJECT'],
    ],
    input: [outside, [...source, ...reject]],
    schemaVersion: 1,
  };
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
function decodeEvidence(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail();
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length === 0 || bytes.length > 131_072 || bytes.toString('base64') !== value) fail();
  return bytes;
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
export function createRegistrationCaptureEvidence({ addresses, dockerNetworks, services } = {}) {
  const serviceBytes = Buffer.from(canonicalJson(services));
  return Object.freeze({
    addresses: decodeEvidence(Buffer.from(addresses).toString('base64')).toString('base64'),
    dockerNetworks: decodeEvidence(Buffer.from(dockerNetworks).toString('base64')).toString('base64'),
    schemaVersion: 1,
    services: decodeEvidence(serviceBytes.toString('base64')).toString('base64'),
  });
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
export function deriveRegistrationCaptureAuthority({
  addresses,
  dockerNetworks,
  externalInterface,
  services,
} = {}) {
  if (
    !exact(externalInterface, ['ifindex', 'name']) ||
    !INTERFACE.test(externalInterface.name) ||
    !Number.isSafeInteger(externalInterface.ifindex) ||
    externalInterface.ifindex < 1
  )
    fail();
  const hostAddresses = hostIpv4Addresses(addresses);
  const dockerSubnets = productionDockerSubnets(dockerNetworks);
  const uids = nonrootServiceUids(services);
  const policy = sealedPolicy();
  const denied = [
    ...new Set([
      ...policy.dedicatedRuntime.deniedDestinationCidrs,
      ...hostAddresses.map((address) => `${address}/32`),
      ...dockerSubnets,
    ]),
  ].sort();
  if (!denied.every((cidr) => CIDR.test(cidr))) fail();
  return Object.freeze({
    expectedEgressPlan: Object.freeze(
      expectedEgressPlan(externalInterface.name, denied, policy.dedicatedRuntime)
    ),
    externalIfindex: externalInterface.ifindex,
    externalInterface: externalInterface.name,
    hostIpv4Addresses: Object.freeze(hostAddresses),
    nonrootServiceUids: Object.freeze(uids),
    productionDockerSubnets: Object.freeze(dockerSubnets),
  });
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
export function deriveRegistrationCaptureAuthorityFromEvidence({ evidence, externalInterface, inventoryDigests } = {}) {
  if (!exact(evidence, EVIDENCE_FIELDS) || evidence.schemaVersion !== 1) fail();
  const addresses = decodeEvidence(evidence.addresses);
  const dockerNetworks = decodeEvidence(evidence.dockerNetworks);
  if (inventoryDigests && (sha256(addresses) !== inventoryDigests.addresses || sha256(dockerNetworks) !== inventoryDigests.dockerNetworks)) fail();
  const services = JSON.parse(decodeEvidence(evidence.services).toString('utf8'));
  return deriveRegistrationCaptureAuthority({ addresses, dockerNetworks, externalInterface, services });
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
export async function readRegistrationCaptureAuthority({ expectedSha256, root, transactionId } = {}) {
  const { verifyCapture } = await import('./campaign-state.mjs');
  const capture = await verifyCapture({ expectedSha256, root, transactionId });
  if (capture.mode !== 'registration') fail();
  const authority = Object.fromEntries(AUTHORITY_FIELDS.map((field) => [field, capture[field]]));
  try {
    const evidence = capture.registrationAuthorityEvidence;
    const derived = deriveRegistrationCaptureAuthorityFromEvidence({ evidence, externalInterface: capture.priorState.network.externalInterface, inventoryDigests: capture.priorState.network.inventories });
    const canonical = canonicalJson(authority);
    if (canonicalJson(derived) !== canonical) fail();
    return Buffer.from(canonical, 'utf8');
  } catch {
    fail();
  }
}

// biome-ignore format: keeps the capture module below the sealed source ceiling.
async function main([command, addressesPath, dockerNetworksPath, servicesPath, name, ifindex]) {
  if (command !== 'derive' || ifindex === undefined) fail();
  const authority = deriveRegistrationCaptureAuthority({
    addresses: await readFile(addressesPath),
    dockerNetworks: await readFile(dockerNetworksPath),
    externalInterface: { ifindex: Number(ifindex), name },
    services: JSON.parse(await readFile(servicesPath, 'utf8')),
  });
  process.stdout.write(canonicalJson(authority));
}

if (import.meta.filename === process.argv[1])
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write('authority capture refused\n');
    process.exitCode = 1;
  });
