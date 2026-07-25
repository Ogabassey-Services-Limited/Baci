import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { buildReceipt } from './install-prepare-acceptance.fixture.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import {
  createRegistrationRuntimeAuthority,
  prepareRegistrationRuntimeContract,
  registrationConfigureArgv,
  registrationNodeArgv,
} from './registration-runtime-contract.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const policyBytes = readFileSync(new URL('./policy.json', import.meta.url));
const policy = parseRunnerPolicy(JSON.parse(policyBytes));
const capture = {
  expectedEgressPlan: { default: 'drop', external: 'eth0' },
  externalIfindex: 2,
  externalInterface: 'eth0',
  hostIpv4Addresses: ['82.29.190.219'],
  nonrootServiceUids: [1000, 10002],
  productionDockerSubnets: ['172.18.0.0/16'],
};
const runtimeReceipt = {
  executables: {
    listener: {
      path: '/opt/runner/bin/Runner.Listener',
      sha256: buildReceipt.processMap.entries.find(
        (row) => row.role === 'listener'
      ).sha256,
    },
    node: {
      path: '/opt/node/bin/node',
      sha256: buildReceipt.processMap.entries.find(
        (row) => row.role === 'runtimeNode'
      ).sha256,
    },
  },
  imageId: buildReceipt.imageId,
  schemaVersion: 1,
};
const persistedAuthority = {
  campaignId: 'registration-01',
  registrationNonce: '1'.repeat(32),
  releaseNonce: '2'.repeat(32),
  schemaVersion: 1,
  stagingNonce: '3'.repeat(32),
};
const expectedConfigureArgv = Object.freeze([
  '/registration-staging/actions-runner/bin/Runner.Listener',
  'configure',
  '--unattended',
  '--url',
  'https://github.com/ogabasseyy/Baci',
  '--name',
  'baci-cwv-measurement-01',
  '--labels',
  'baci-cwv-measurement',
  '--work',
  '/runner-work',
  '--disableupdate',
]);

test('matches the direct listener registration argv from the sealed policy', () => {
  const argv = registrationConfigureArgv(policy);

  assert.deepEqual(argv, expectedConfigureArgv);
  assert.equal(argv.includes('--replace'), false);
  assert.equal(
    argv.some((value) => value.startsWith('/opt/runner')),
    false
  );
});

test('derives static authority only from sealed receipts and root randomness', async () => {
  const random = [
    Buffer.alloc(16, 6),
    Buffer.alloc(16, 7),
    Buffer.alloc(16, 8),
  ];
  const authority = createRegistrationRuntimeAuthority({
    randomBytes: (size) => {
      assert.equal(size, 16);
      return random.shift();
    },
    randomUuid: () => '123e4567-e89b-12d3-a456-426614174000',
  });
  const configuration = await prepareRegistrationRuntimeContract({
    readCampaign: async () => Buffer.from(canonicalJson(authority)),
    readCapture: async () => Buffer.from(canonicalJson(capture)),
    readImageReceipt: async () =>
      Buffer.from(
        canonicalJson({
          ...buildReceipt,
          policyFileSha256: sha256(policyBytes),
        })
      ),
    readPolicy: async () => policyBytes,
    readRuntimeReceipt: async () => Buffer.from(canonicalJson(runtimeReceipt)),
  });

  assert.equal(configuration.schemaVersion, 2);
  assert.equal(
    configuration.context.captureSha256,
    sha256(canonicalJson(capture))
  );
  assert.equal(configuration.context.registrationNonce, '06'.repeat(16));
  assert.deepEqual(configuration.resources.networkAuthority, {
    deniedDestinationCidrs: [
      ...new Set([
        ...policy.dedicatedRuntime.deniedDestinationCidrs,
        '82.29.190.219/32',
        '172.18.0.0/16',
      ]),
    ].sort(),
    expectedEgressPlanSha256: sha256(canonicalJson(capture.expectedEgressPlan)),
    externalIfindex: 2,
    externalInterface: 'eth0',
    nonrootServiceUids: [1000, 10001, 10002],
  });
  assert.equal(
    configuration.context.nodeArgvSha256,
    sha256(canonicalJson(registrationNodeArgv()))
  );
  assert.equal(
    configuration.context.configureArgvSha256,
    sha256(canonicalJson(registrationConfigureArgv(policy)))
  );
});

test('refuses a runtime receipt that is not cross-checked with the image process map', async () => {
  await assert.rejects(
    prepareRegistrationRuntimeContract({
      readCampaign: async () => Buffer.from(canonicalJson(persistedAuthority)),
      readCapture: async () => Buffer.from(canonicalJson(capture)),
      readImageReceipt: async () =>
        Buffer.from(
          canonicalJson({
            ...buildReceipt,
            policyFileSha256: sha256(policyBytes),
          })
        ),
      readPolicy: async () => policyBytes,
      readRuntimeReceipt: async () =>
        Buffer.from(
          canonicalJson({
            ...runtimeReceipt,
            executables: {
              ...runtimeReceipt.executables,
              node: {
                ...runtimeReceipt.executables.node,
                sha256: '0'.repeat(64),
              },
            },
          })
        ),
    }),
    /registration runtime contract refused/
  );
});

test('refuses an unreadable root-owned authority source', async () => {
  await assert.rejects(
    prepareRegistrationRuntimeContract({
      readCampaign: () => {
        throw new Error('unreadable');
      },
      readCapture: () => Buffer.alloc(0),
      readImageReceipt: () => Buffer.alloc(0),
      readPolicy: () => Buffer.alloc(0),
      readRuntimeReceipt: () => Buffer.alloc(0),
    }),
    /registration runtime contract refused/
  );
});
