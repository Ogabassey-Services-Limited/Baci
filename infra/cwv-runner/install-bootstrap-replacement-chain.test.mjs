import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';

const policyFileSha256 = 'e'.repeat(64);
const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const absent = { absent: true };
const file = (digit) => ({
  sha256: digit.repeat(64),
  mode: '0600',
  owner: 'root:root',
});
const captured = ({ source, capture, prior, files }) => ({
  phase: 'captured',
  sourceSha: source.repeat(40),
  sourceManifestSha256: source.repeat(64),
  policyFileSha256,
  captureSha256: capture.repeat(64),
  prior: { [path]: prior },
  files: { [path]: files },
});
const completed = (state, receipt = 'f') => ({
  ...state,
  phase: 'complete',
  receiptSha256: receipt.repeat(64),
  receipt: {
    sourceSha: state.sourceSha,
    sourceManifestSha256: state.sourceManifestSha256,
    policyFileSha256,
    files: state.files,
  },
});

test('uses a completed recovery after its captured ancestors remain in inventory', () => {
  const first = captured({
    source: '1',
    capture: 'a',
    prior: absent,
    files: file('1'),
  });
  const second = captured({
    source: '2',
    capture: 'b',
    prior: file('1'),
    files: file('2'),
  });
  const recovered = {
    ...captured({
      source: '3',
      capture: 'c',
      prior: file('2'),
      files: file('3'),
    }),
    phase: 'complete',
    receiptSha256: 'd'.repeat(64),
    receipt: {
      sourceSha: '3'.repeat(40),
      sourceManifestSha256: '3'.repeat(64),
      policyFileSha256,
      files: { [path]: file('3') },
    },
  };
  const upgrade = captured({
    source: '4',
    capture: 'e',
    prior: file('3'),
    files: file('4'),
  });

  assert.deepEqual(
    resolveBootstrapReplacementChain(
      [first, second, recovered, upgrade],
      upgrade
    ).map((state) => state.sourceSha),
    [recovered.sourceSha, upgrade.sourceSha]
  );
});

test('refuses an unbound captured ancestor behind a completed recovery', () => {
  const unbound = captured({
    source: '1',
    capture: 'a',
    prior: file('0'),
    files: file('1'),
  });
  const recovered = {
    ...captured({
      source: '2',
      capture: 'b',
      prior: file('1'),
      files: file('2'),
    }),
    phase: 'complete',
    receiptSha256: 'c'.repeat(64),
    receipt: {
      sourceSha: '2'.repeat(40),
      sourceManifestSha256: '2'.repeat(64),
      policyFileSha256,
      files: { [path]: file('2') },
    },
  };
  const upgrade = captured({
    source: '3',
    capture: 'd',
    prior: file('2'),
    files: file('3'),
  });

  assert.throws(
    () =>
      resolveBootstrapReplacementChain([unbound, recovered, upgrade], upgrade),
    /replacement authority chain/
  );
});

test('refuses ambiguous captured history behind a completed recovery', () => {
  const first = captured({
    source: '1',
    capture: 'a',
    prior: absent,
    files: file('1'),
  });
  const competing = { ...first, sourceSha: '2'.repeat(40) };
  const recovered = {
    ...captured({
      source: '3',
      capture: 'b',
      prior: file('1'),
      files: file('3'),
    }),
    phase: 'complete',
    receiptSha256: 'c'.repeat(64),
    receipt: {
      sourceSha: '3'.repeat(40),
      sourceManifestSha256: '3'.repeat(64),
      policyFileSha256,
      files: { [path]: file('3') },
    },
  };
  const upgrade = captured({
    source: '4',
    capture: 'd',
    prior: file('3'),
    files: file('4'),
  });

  assert.throws(
    () =>
      resolveBootstrapReplacementChain(
        [first, competing, recovered, upgrade],
        upgrade
      ),
    /replacement authority chain/
  );
});

test('proves a partially installed projection through captured generations', () => {
  const baseline = completed(
    captured({
      source: '1',
      capture: 'a',
      prior: absent,
      files: file('1'),
    })
  );
  const interrupted = captured({
    source: '2',
    capture: 'b',
    prior: file('1'),
    files: file('2'),
  });
  const current = captured({
    source: '3',
    capture: 'c',
    prior: file('1'),
    files: file('3'),
  });

  assert.deepEqual(
    resolveBootstrapReplacementChain(
      [current, interrupted, baseline],
      current
    ).map((state) => state.sourceSha),
    [baseline.sourceSha, interrupted.sourceSha, current.sourceSha]
  );
});

test('uses the latest completed baseline while retaining its completed ancestor', () => {
  const first = completed(
    captured({
      source: '1',
      capture: 'a',
      prior: absent,
      files: file('1'),
    })
  );
  const latest = completed(
    captured({
      source: '2',
      capture: 'b',
      prior: file('1'),
      files: file('2'),
    }),
    'e'
  );
  const current = captured({
    source: '3',
    capture: 'c',
    prior: file('2'),
    files: file('3'),
  });

  assert.deepEqual(
    resolveBootstrapReplacementChain([first, latest, current], current).map(
      (state) => state.sourceSha
    ),
    [latest.sourceSha, current.sourceSha]
  );
});

test('refuses orphaned completed replacement history', () => {
  const baseline = completed(
    captured({
      source: '1',
      capture: 'a',
      prior: absent,
      files: file('1'),
    })
  );
  const orphan = completed(
    captured({
      source: '2',
      capture: 'b',
      prior: file('8'),
      files: file('9'),
    }),
    'e'
  );
  const current = captured({
    source: '3',
    capture: 'c',
    prior: file('1'),
    files: file('3'),
  });

  assert.throws(
    () =>
      resolveBootstrapReplacementChain([baseline, orphan, current], current),
    /replacement authority chain/
  );
});

test('accepts only an all-absent captured authority root', () => {
  const pristine = captured({
    source: '1',
    capture: 'a',
    prior: absent,
    files: file('1'),
  });
  const current = captured({
    source: '2',
    capture: 'b',
    prior: file('1'),
    files: file('2'),
  });
  assert.deepEqual(
    resolveBootstrapReplacementChain([current, pristine], current),
    [pristine, current]
  );

  assert.throws(
    () =>
      resolveBootstrapReplacementChain(
        [{ ...pristine, prior: { [path]: file('0') } }, current],
        current
      ),
    /replacement authority chain/
  );
});
