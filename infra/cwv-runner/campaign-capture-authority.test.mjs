import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createRegistrationCaptureEvidence,
  deriveRegistrationCaptureAuthority,
  readRegistrationCaptureAuthority,
} from './campaign-capture-authority.mjs';
import { createCapture } from './campaign-state.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const addresses = Buffer.from(
  JSON.stringify([
    { addr_info: [{ family: 'inet', local: '82.29.190.219' }] },
    { addr_info: [{ family: 'inet', local: '10.0.0.9' }] },
  ])
);
const dockerNetworks = Buffer.from(
  JSON.stringify([
    { IPAM: { Config: [{ Subnet: '172.18.0.0/16' }] } },
    { IPAM: { Config: [{ Subnet: '172.19.0.0/16' }] } },
  ])
);
const services = Object.freeze([
  { unit: 'baci.service', uid: 10 },
  { unit: 'root.service', uid: 0 },
  { unit: 'worker.service', uid: 2 },
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const priorState = {
  schemaVersion: 1,
  cron: {
    sha256: 'a'.repeat(64),
    archiveSha256: 'b'.repeat(64),
    archivePath: '/srv/baci-cwv/campaigns/tx/crontab.before',
    serviceActive: true,
    serviceEnabled: true,
  },
  resources: { runners: [], timers: [], containers: [], slices: [] },
  network: {
    accountingTablePresent: false,
    baselineSha256: 'c'.repeat(64),
    campaignMark: 0xb1234567,
    collisions: [],
    externalInterface: { ifindex: 2, name: 'eth0' },
    inventories: Object.fromEntries(
      'nftables iptables ip6tables ipRules4 ipRules6 tc conntrack addresses routes dockerNetworks'
        .split(' ')
        .map((name) => [name, 'd'.repeat(64)])
    ),
    ipForward: 1,
  },
};
const registrationPriorState = {
  ...priorState,
  network: {
    ...priorState.network,
    inventories: {
      ...priorState.network.inventories,
      addresses: digest(addresses),
      dockerNetworks: digest(dockerNetworks),
    },
  },
};
const registrationAuthorityEvidence = createRegistrationCaptureEvidence({
  addresses,
  dockerNetworks,
  services,
});

test('derives a canonical registration authority only from captured inventories', () => {
  const authority = deriveRegistrationCaptureAuthority({
    addresses,
    dockerNetworks,
    externalInterface: { ifindex: 2, name: 'eth0' },
    services,
  });

  assert.deepEqual(Object.keys(authority), [
    'expectedEgressPlan',
    'externalIfindex',
    'externalInterface',
    'hostIpv4Addresses',
    'nonrootServiceUids',
    'productionDockerSubnets',
  ]);
  assert.deepEqual(authority.hostIpv4Addresses, ['10.0.0.9', '82.29.190.219']);
  assert.deepEqual(authority.productionDockerSubnets, [
    '172.18.0.0/16',
    '172.19.0.0/16',
  ]);
  assert.deepEqual(authority.nonrootServiceUids, [2, 10]);
  assert.equal(authority.expectedEgressPlan.schemaVersion, 1);
  assert.match(canonicalJson(authority), /^\{"expectedEgressPlan":/);
});

test('derives egress topology from the sealed policy rather than duplicated constants', () => {
  const authority = deriveRegistrationCaptureAuthority({
    addresses,
    dockerNetworks,
    externalInterface: { ifindex: 2, name: 'eth0' },
    services,
  });
  const policy = parseRunnerPolicy(
    JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
  );
  const source = readFileSync(
    new URL('./campaign-capture-authority.mjs', import.meta.url),
    'utf8'
  );

  assert.deepEqual(authority.expectedEgressPlan.input[0], [
    '-i',
    policy.dedicatedRuntime.bridgeName,
    '!',
    '-s',
    policy.dedicatedRuntime.subnet,
    '-j',
    'REJECT',
  ]);
  assert.doesNotMatch(source, /const bridge = 'baci-cwv0'/);
  assert.doesNotMatch(source, /const subnet = '172\.31\.255\.0\/28'/);
  assert.doesNotMatch(source, /'172\.31\.255\.1\/32'/);
});

test('rejects missing, invalid, duplicate, or ambiguous live capture evidence', () => {
  const valid = {
    addresses,
    dockerNetworks,
    externalInterface: { ifindex: 2, name: 'eth0' },
    services,
  };
  assert.throws(
    () =>
      deriveRegistrationCaptureAuthority({
        ...valid,
        addresses: Buffer.from('[]'),
      }),
    /authority capture refused/
  );
  assert.throws(
    () =>
      deriveRegistrationCaptureAuthority({
        ...valid,
        addresses: Buffer.from(
          JSON.stringify([
            { addr_info: [{ family: 'inet', local: '999.0.0.1' }] },
          ])
        ),
      }),
    /authority capture refused/
  );
  assert.throws(
    () =>
      deriveRegistrationCaptureAuthority({
        ...valid,
        dockerNetworks: Buffer.from(
          JSON.stringify([
            { IPAM: { Config: [{ Subnet: '172.18.0.0/16' }] } },
            { IPAM: { Config: [{ Subnet: '172.18.0.0/16' }] } },
          ])
        ),
      }),
    /authority capture refused/
  );
  assert.throws(
    () =>
      deriveRegistrationCaptureAuthority({
        ...valid,
        services: [
          { unit: 'baci.service', uid: 10 },
          { unit: 'baci.service', uid: 2 },
        ],
      }),
    /authority capture refused/
  );
  assert.throws(
    () =>
      deriveRegistrationCaptureAuthority({
        ...valid,
        services: [...services].reverse(),
      }),
    /authority capture refused/
  );
});

test('refuses caller-provided registration authority outside a bound registration capture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-capture-authority-'));
  await chmod(root, 0o700);
  const registrationAuthority = deriveRegistrationCaptureAuthority({
    addresses,
    dockerNetworks,
    externalInterface: { ifindex: 2, name: 'eth0' },
    services,
  });

  await assert.rejects(
    () =>
      createCapture({
        host: { bootId: 'boot-a', hostname: 'host' },
        mode: 'registration',
        priorState,
        root,
        transactionId: 'missing-registration-authority',
      }),
    /registration capture authority required/
  );
  await assert.rejects(
    () =>
      createCapture({
        host: { bootId: 'boot-a', hostname: 'host' },
        mode: 'campaign',
        priorState,
        registrationAuthority,
        root,
        transactionId: 'authority-outside-registration',
      }),
    /registration mode/
  );
  await assert.rejects(
    () =>
      createCapture({
        host: { bootId: 'boot-a', hostname: 'host' },
        mode: 'registration',
        priorState: registrationPriorState,
        registrationAuthority: { ...registrationAuthority, injected: true },
        registrationAuthorityEvidence,
        root,
        transactionId: 'authority-extra-field',
      }),
    /registration authority/
  );
  await assert.rejects(
    () =>
      createCapture({
        host: { bootId: 'boot-a', hostname: 'host' },
        mode: 'registration',
        priorState: {
          ...registrationPriorState,
          network: {
            ...registrationPriorState.network,
            inventories: {
              ...registrationPriorState.network.inventories,
              addresses: 'e'.repeat(64),
            },
          },
        },
        registrationAuthority,
        registrationAuthorityEvidence,
        root,
        transactionId: 'authority-inventory-digest-mismatch',
      }),
    /registration authority/
  );
});

test('reads exactly six canonical authority fields from the digest-bound capture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-capture-authority-'));
  await chmod(root, 0o700);
  const registrationAuthority = deriveRegistrationCaptureAuthority({
    addresses,
    dockerNetworks,
    externalInterface: { ifindex: 2, name: 'eth0' },
    services,
  });
  const created = await createCapture({
    host: { bootId: 'boot-a', hostname: 'host' },
    mode: 'registration',
    priorState: registrationPriorState,
    registrationAuthority,
    registrationAuthorityEvidence,
    root,
    transactionId: 'registration-capture',
  });

  const bytes = await readRegistrationCaptureAuthority({
    expectedSha256: created.sha256,
    root,
    transactionId: 'registration-capture',
  });

  assert.equal(bytes.toString('utf8'), canonicalJson(registrationAuthority));
  assert.deepEqual(Object.keys(JSON.parse(bytes)), [
    'expectedEgressPlan',
    'externalIfindex',
    'externalInterface',
    'hostIpv4Addresses',
    'nonrootServiceUids',
    'productionDockerSubnets',
  ]);
});
