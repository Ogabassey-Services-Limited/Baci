import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  parseRegistrationRootConfiguration,
  serializeRegistrationRootConfiguration,
} from './registration-root-configuration.mjs';

const hash = (value) => value.repeat(64).slice(0, 64);
const configuration = {
  context: {
    campaignId: 'registration-01',
    captureSha256: hash('a'),
    configureArgvSha256: hash('b'),
    imageDigest: `sha256:${hash('c')}`,
    listenerExecutableSha256: hash('d'),
    nodeArgvSha256: hash('e'),
    nodeExecutableSha256: hash('f'),
    phaseEnvironmentSha256: {
      'listener-configure': hash('1'),
      'node-ready': hash('2'),
      'node-started': hash('3'),
      'node-token-absent': hash('4'),
      'post-container': null,
      'pre-start': null,
    },
    policyFileSha256: hash('5'),
    registrationNonce: '6'.repeat(32),
    releaseNonce: '7'.repeat(32),
    stagingNonce: '8'.repeat(32),
  },
  resources: {
    cgroupParent: 'cwv-measurement.slice',
    cpusetCpus: '2-3',
    dockerSocket: 'unix:///run/baci-cwv/docker.sock',
    memoryBytes: 8_589_934_592,
    memorySwapBytes: 0,
    networkAuthority: {
      deniedDestinationCidrs: ['10.0.0.0/8', '127.0.0.0/8'],
      expectedEgressPlanSha256: hash('9'),
      externalIfindex: 2,
      externalInterface: 'eth0',
      nonrootServiceUids: [1000, 10001],
    },
    pidsLimit: 1024,
    runnerGid: 10001,
    runnerUid: 10001,
    shmBytes: 1_073_741_824,
  },
  schemaVersion: 2,
};

test('accepts only canonical schema-v2 static registration authority', () => {
  const bytes = serializeRegistrationRootConfiguration(configuration);
  assert.equal(bytes.toString('utf8'), canonicalJson(configuration));
  assert.deepEqual(parseRegistrationRootConfiguration(bytes), configuration);

  const forbidden = structuredClone(configuration);
  forbidden.context.registrationReadySha256 = hash('a');
  assert.throws(
    () =>
      parseRegistrationRootConfiguration(
        Buffer.from(canonicalJson(forbidden), 'utf8')
      ),
    /registration root configuration refused/
  );

  const unordered = structuredClone(configuration);
  unordered.resources.networkAuthority.nonrootServiceUids.reverse();
  assert.throws(
    () =>
      parseRegistrationRootConfiguration(
        Buffer.from(canonicalJson(unordered), 'utf8')
      ),
    /registration root configuration refused/
  );
});
