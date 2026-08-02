import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';

const existingPath = '/srv/baci-cwv/sealed/bootstrap.sha256';
const addedPath = '/srv/baci-cwv/sealed/new-helper.mjs';
const absent = { absent: true };
const file = (digit) => ({
  sha256: digit.repeat(64),
  mode: '0600',
  owner: 'root:root',
});
const captured = ({ source, prior, files }) => ({
  phase: 'captured',
  sourceSha: source.repeat(40),
  sourceManifestSha256: source.repeat(64),
  policyFileSha256: 'e'.repeat(64),
  captureSha256: source.repeat(64),
  prior,
  files,
});
const completed = (state) => ({
  ...state,
  phase: 'complete',
  receiptSha256: 'f'.repeat(64),
  receipt: {
    sourceSha: state.sourceSha,
    sourceManifestSha256: state.sourceManifestSha256,
    policyFileSha256: state.policyFileSha256,
    files: state.files,
  },
});

test('allows a captured generation to add a path proven previously absent', () => {
  const first = captured({
    source: '1',
    prior: { [existingPath]: absent },
    files: { [existingPath]: file('1') },
  });
  const current = captured({
    source: '2',
    prior: {
      [existingPath]: file('1'),
      [addedPath]: absent,
    },
    files: {
      [existingPath]: file('2'),
      [addedPath]: file('3'),
    },
  });

  assert.deepEqual(
    resolveBootstrapReplacementChain([first, current], current),
    [first, current]
  );
});

test('allows a completed generation to add a path proven previously absent', () => {
  const first = completed(
    captured({
      source: '1',
      prior: { [existingPath]: absent },
      files: { [existingPath]: file('1') },
    })
  );
  const current = captured({
    source: '2',
    prior: {
      [existingPath]: file('1'),
      [addedPath]: absent,
    },
    files: {
      [existingPath]: file('2'),
      [addedPath]: file('3'),
    },
  });

  assert.deepEqual(
    resolveBootstrapReplacementChain([first, current], current),
    [first, current]
  );
});

test('refuses a completed-generation addition not proven absent', () => {
  const first = completed(
    captured({
      source: '1',
      prior: { [existingPath]: absent },
      files: { [existingPath]: file('1') },
    })
  );
  const current = captured({
    source: '2',
    prior: {
      [existingPath]: file('1'),
      [addedPath]: file('9'),
    },
    files: {
      [existingPath]: file('2'),
      [addedPath]: file('3'),
    },
  });

  assert.throws(
    () => resolveBootstrapReplacementChain([first, current], current),
    /replacement authority chain/
  );
});

test('refuses removal of a path managed by the captured predecessor', () => {
  const first = captured({
    source: '1',
    prior: { [existingPath]: absent, [addedPath]: absent },
    files: { [existingPath]: file('1'), [addedPath]: file('2') },
  });
  const current = captured({
    source: '2',
    prior: { [existingPath]: file('1') },
    files: { [existingPath]: file('3') },
  });

  assert.throws(
    () => resolveBootstrapReplacementChain([first, current], current),
    /replacement authority chain/
  );
});

test('refuses an added path not proven absent by the new capture', () => {
  const first = captured({
    source: '1',
    prior: { [existingPath]: absent },
    files: { [existingPath]: file('1') },
  });
  const current = captured({
    source: '2',
    prior: {
      [existingPath]: file('1'),
      [addedPath]: file('9'),
    },
    files: {
      [existingPath]: file('2'),
      [addedPath]: file('3'),
    },
  });

  assert.throws(
    () => resolveBootstrapReplacementChain([first, current], current),
    /replacement authority chain/
  );
});

test('refuses present metadata drift on a predecessor-managed path', () => {
  const first = captured({
    source: '1',
    prior: { [existingPath]: absent },
    files: { [existingPath]: file('1') },
  });
  const current = captured({
    source: '2',
    prior: { [existingPath]: file('9') },
    files: { [existingPath]: file('2') },
  });

  assert.throws(
    () => resolveBootstrapReplacementChain([first, current], current),
    /replacement authority chain/
  );
});
