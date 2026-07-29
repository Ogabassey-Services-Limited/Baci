import assert from 'node:assert/strict';
import test from 'node:test';

import {
  planBootstrapReplacement,
  resolveBootstrapReplacementChain,
} from './install-bootstrap-replacement.mjs';

const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);
const policy = 'e'.repeat(64);
const oldBootstrap = {
  sha256: '1'.repeat(64),
  mode: '0600',
  owner: 'root:root',
};
const newBootstrap = {
  sha256: '2'.repeat(64),
  mode: '0600',
  owner: 'root:root',
};
const oldWatchdog = {
  sha256: '3'.repeat(64),
  mode: '0644',
  owner: 'root:root',
};
const newWatchdog = {
  sha256: '4'.repeat(64),
  mode: '0644',
  owner: 'root:root',
};
const bootstrapPath = '/srv/baci-cwv/sealed/bootstrap.sha256';
const watchdogPath = '/etc/systemd/system/baci-cwv-campaign-watchdog@.service';
const previousFiles = {
  [bootstrapPath]: oldBootstrap,
  [watchdogPath]: oldWatchdog,
};
const nextFiles = {
  [bootstrapPath]: newBootstrap,
  [watchdogPath]: newWatchdog,
};
const previousState = {
  phase: 'complete',
  sourceSha: oldSource,
  sourceManifestSha256: 'c'.repeat(64),
  policyFileSha256: policy,
  receiptSha256: '5'.repeat(64),
  receipt: {
    sourceSha: oldSource,
    sourceManifestSha256: 'c'.repeat(64),
    policyFileSha256: policy,
    files: previousFiles,
  },
};
const nextState = {
  phase: 'captured',
  sourceSha: newSource,
  sourceManifestSha256: 'd'.repeat(64),
  policyFileSha256: policy,
  captureSha256: '6'.repeat(64),
  prior: previousFiles,
  files: nextFiles,
};
const inertHost = {
  acceptedImageFiles: 0,
  activeDedicatedUnits: 0,
  prepareTransactions: 0,
  registrationArtifacts: 0,
  runnerConfigurationFiles: 0,
  unsafeUnitStates: 0,
  watchdogInstances: 0,
};

test('plans forward repair when installed paths are exactly prior or next bytes', () => {
  const plan = planBootstrapReplacement({
    authorityChain: [previousState, nextState],
    nextState,
    installedProjection: {
      [bootstrapPath]: oldBootstrap,
      [watchdogPath]: newWatchdog,
    },
    downstreamState: inertHost,
  });
  assert.match(plan.installedProjectionSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(plan.transitionPaths, [watchdogPath, bootstrapPath]);
  assert.deepEqual(plan.replace, [bootstrapPath]);
  assert.deepEqual(plan.alreadyCurrent, [watchdogPath]);
  assert.equal(plan.baselineKind, 'complete');
  assert.equal(plan.baselineSourceSha, previousState.sourceSha);
  assert.equal(plan.baselineStateSha256, previousState.receiptSha256);
});

test('refuses third-party drift instead of treating it as prior or next bytes', () => {
  assert.throws(
    () =>
      planBootstrapReplacement({
        authorityChain: [previousState, nextState],
        nextState,
        installedProjection: {
          [bootstrapPath]: { ...oldBootstrap, sha256: '7'.repeat(64) },
          [watchdogPath]: newWatchdog,
        },
        downstreamState: inertHost,
      }),
    /installed bootstrap path is neither prior nor current/
  );
});

test('refuses an empty replacement transition before persisting an unreadable intent', () => {
  const unchanged = { ...nextState, files: previousFiles };
  assert.throws(
    () =>
      planBootstrapReplacement({
        authorityChain: [previousState, unchanged],
        nextState: unchanged,
        installedProjection: previousFiles,
        downstreamState: inertHost,
      }),
    /bootstrap replacement transition required/
  );
});

test('refuses an unbound prior generation or downstream provisioning', () => {
  const unbound = {
    ...nextState,
    prior: { ...previousFiles, [bootstrapPath]: newBootstrap },
  };
  assert.throws(
    () =>
      planBootstrapReplacement({
        authorityChain: [previousState, unbound],
        nextState: unbound,
        installedProjection: previousFiles,
        downstreamState: inertHost,
      }),
    /replacement authority chain/
  );
  assert.throws(
    () =>
      planBootstrapReplacement({
        authorityChain: [previousState, nextState],
        nextState,
        installedProjection: previousFiles,
        downstreamState: { ...inertHost, registrationArtifacts: 1 },
      }),
    /downstream provisioning exists/
  );
});

test('proves a mixed projection through receipt-bound interrupted generations', () => {
  const intermediateSource = 'f'.repeat(40);
  const intermediate = {
    ...nextState,
    sourceSha: intermediateSource,
    captureSha256: '8'.repeat(64),
    prior: previousFiles,
    files: {
      [bootstrapPath]: { ...newBootstrap, sha256: '7'.repeat(64) },
      [watchdogPath]: newWatchdog,
    },
  };
  const current = {
    ...nextState,
    prior: { [bootstrapPath]: oldBootstrap, [watchdogPath]: newWatchdog },
  };
  assert.deepEqual(
    resolveBootstrapReplacementChain(
      [current, intermediate, previousState],
      current
    ).map((state) => state.sourceSha),
    [oldSource, intermediateSource, newSource]
  );
  assert.throws(
    () =>
      resolveBootstrapReplacementChain(
        [
          current,
          {
            ...intermediate,
            prior: {
              ...previousFiles,
              [bootstrapPath]: { ...oldBootstrap, sha256: '9'.repeat(64) },
            },
          },
          previousState,
        ],
        current
      ),
    /replacement authority chain/
  );
});

test('proves a first-install chain only from one all-absent pristine capture', () => {
  const pristineSource = '0'.repeat(40);
  const absent = { absent: true };
  const pristine = {
    ...nextState,
    sourceSha: pristineSource,
    captureSha256: '0'.repeat(64),
    prior: { [bootstrapPath]: absent, [watchdogPath]: absent },
    files: previousFiles,
  };
  const current = { ...nextState, prior: previousFiles };
  const chain = resolveBootstrapReplacementChain([current, pristine], current);
  const plan = planBootstrapReplacement({
    authorityChain: chain,
    nextState: current,
    installedProjection: previousFiles,
    downstreamState: inertHost,
  });
  assert.equal(plan.baselineKind, 'pristine');
  assert.equal(plan.baselineSourceSha, pristineSource);
  assert.equal(plan.baselineStateSha256, pristine.captureSha256);
});

test('refuses a captured root that is neither complete nor all-absent', () => {
  const invalidRoot = {
    ...nextState,
    sourceSha: '0'.repeat(40),
    captureSha256: '0'.repeat(64),
    prior: {
      [bootstrapPath]: { absent: true },
      [watchdogPath]: oldWatchdog,
    },
    files: previousFiles,
  };
  assert.throws(
    () => resolveBootstrapReplacementChain([invalidRoot, nextState], nextState),
    /replacement authority chain/
  );
});
