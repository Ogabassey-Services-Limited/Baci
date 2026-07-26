import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveLiveServiceState,
  serviceStateDigest,
} from './install-verify.mjs';

test('emits a canonical digest over exact bootstrap, image, and service state', () => {
  const input = {
    bootstrapReceiptSha256: 'a'.repeat(64),
    imageId: `sha256:${'b'.repeat(64)}`,
    imageReceiptSha256: 'c'.repeat(64),
    registrationComplete: false,
    runnerIdentitySha256: null,
    runtimeContextSha256: 'f'.repeat(64),
    runtimeManifestSha256: '1'.repeat(64),
    serviceFilesSha256: 'd'.repeat(64),
    servicesDisabled: true,
    dedicatedRuntimeActive: false,
    campaignStateSha256: 'e'.repeat(64),
  };
  const result = serviceStateDigest(input);

  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.bytes, JSON.stringify(JSON.parse(result.bytes)));
  assert.deepEqual(Object.keys(result.value), [
    'bootstrapReceiptSha256',
    'campaignStateSha256',
    'dedicatedRuntimeActive',
    'imageId',
    'imageReceiptSha256',
    'registrationComplete',
    'runnerIdentitySha256',
    'runtimeContextSha256',
    'runtimeManifestSha256',
    'schemaVersion',
    'serviceFilesSha256',
    'servicesDisabled',
  ]);
  assert.throws(
    () => serviceStateDigest({ ...input, servicesDisabled: false }),
    /disabled/
  );
  assert.throws(
    () =>
      serviceStateDigest({
        ...input,
        registrationComplete: false,
        runnerIdentitySha256: '9'.repeat(64),
      }),
    /registration terminal receipt refused/
  );
});

test('derives the digest only from one accepted target and disabled inactive units', () => {
  const files = {
    '/etc/systemd/system/baci-cwv-docker.service': {
      mode: '0644',
      owner: 'root:root',
      sha256: 'f'.repeat(64),
    },
    '/srv/baci-cwv/sealed/policy.json': {
      mode: '0400',
      owner: 'root:root',
      sha256: '1'.repeat(64),
    },
  };
  const input = {
    bootstrap: {
      captureSha256: '7'.repeat(64),
      phase: 'complete',
      receiptSha256: 'a'.repeat(64),
      receipt: { disabled: true, files },
    },
    registration: {
      captureSha256: null,
      cleanupSha256: null,
      registrationComplete: false,
      imageDigest: null,
      registrationReleaseSha256: null,
      runnerIdentitySha256: null,
    },
    registrationAuthority: null,
    prepare: {
      phase: 'target-accepted',
      stateSha256: 'e'.repeat(64),
      imageId: `sha256:${'b'.repeat(64)}`,
      expected: { receiptSha256: 'c'.repeat(64) },
    },
    imageIdLine: `BACI_CWV_IMAGE_ID=sha256:${'b'.repeat(64)}\n`,
    imageIdReceipt: '2'.repeat(64),
    computedImageIdReceipt: '2'.repeat(64),
    runtimeReceipt: {
      contextSha256: '3'.repeat(64),
      imageId: `sha256:${'b'.repeat(64)}`,
      manifestSha256: '4'.repeat(64),
    },
    unitStates: [
      {
        name: 'baci-cwv-containerd.service',
        active: 'inactive',
        enabled: 'disabled',
      },
      {
        name: 'baci-cwv-docker.service',
        active: 'inactive',
        enabled: 'disabled',
      },
    ],
    dedicatedSocketExists: false,
  };

  const result = deriveLiveServiceState(input);

  assert.equal(result.value.imageId, input.prepare.imageId);
  assert.equal(
    result.value.runtimeManifestSha256,
    input.runtimeReceipt.manifestSha256
  );
  assert.match(result.value.serviceFilesSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.value.registrationComplete, false);
  assert.equal(result.value.runnerIdentitySha256, null);
  assert.throws(
    () =>
      deriveLiveServiceState({
        ...input,
        runtimeReceipt: {
          ...input.runtimeReceipt,
          imageId: `sha256:${'9'.repeat(64)}`,
        },
      }),
    /accepted image state/
  );
  assert.throws(
    () => deriveLiveServiceState({ ...input, dedicatedSocketExists: true }),
    /dedicated runtime/
  );
  assert.throws(
    () =>
      deriveLiveServiceState({
        ...input,
        unitStates: [
          {
            name: 'baci-cwv-docker.service',
            active: 'active',
            enabled: 'disabled',
          },
        ],
      }),
    /disabled inactive/
  );
  const staticUnits = deriveLiveServiceState({
    ...input,
    unitStates: [
      {
        name: 'baci-cwv-containerd.service',
        active: 'inactive',
        enabled: 'static',
      },
      {
        name: 'baci-cwv-docker.service',
        active: 'inactive',
        enabled: 'static',
      },
    ],
  });
  assert.equal(staticUnits.value.servicesDisabled, true);
  for (const unitStates of [
    [{ name: 'baci-cwv-docker.service', active: 'active', enabled: 'static' }],
    [
      {
        name: 'baci-cwv-docker.service',
        active: 'inactive',
        enabled: 'enabled',
      },
    ],
    [
      {
        name: 'baci-cwv-docker.service',
        active: 'inactive',
        enabled: 'masked',
      },
    ],
    [{ name: 'baci-cwv-docker.service', active: 'inactive' }],
  ])
    assert.throws(
      () => deriveLiveServiceState({ ...input, unitStates }),
      /disabled inactive/
    );
  const registration = {
    captureSha256: input.bootstrap.captureSha256,
    cleanupSha256: '5'.repeat(64),
    registrationComplete: true,
    imageDigest: input.prepare.imageId,
    registrationReleaseSha256: '6'.repeat(64),
    runnerIdentitySha256: '8'.repeat(64),
  };
  const registrationAuthority = {
    captureSha256: registration.captureSha256,
    imageDigest: registration.imageDigest,
    registrationReleaseSha256: registration.registrationReleaseSha256,
  };
  const registered = deriveLiveServiceState({
    ...input,
    registration,
    registrationAuthority,
  });
  assert.equal(
    registered.value.runnerIdentitySha256,
    registration.runnerIdentitySha256
  );
  for (const stale of [
    { ...registration, imageDigest: `sha256:${'9'.repeat(64)}` },
    { ...registration, captureSha256: '9'.repeat(64) },
  ])
    assert.throws(
      () =>
        deriveLiveServiceState({
          ...input,
          registration: stale,
          registrationAuthority,
        }),
      /registration terminal binding/
    );
  assert.throws(
    () =>
      deriveLiveServiceState({
        ...input,
        registration,
        registrationAuthority: {
          ...registrationAuthority,
          registrationReleaseSha256: '9'.repeat(64),
        },
      }),
    /registration terminal binding/
  );
});
