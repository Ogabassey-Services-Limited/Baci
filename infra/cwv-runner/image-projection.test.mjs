import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { archiveIdentity } from './build-image.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';
import { policy } from './image-projection-receipts.fixture.mjs';

test('builds the fixture when GNU tar rejects BSD-only uid and gid flags', () => {
  const tarDirectory = mkdtempSync(join(tmpdir(), 'gnu-tar-'));
  const tar = join(tarDirectory, 'tar');
  writeFileSync(
    tar,
    `#!/bin/sh
for argument do
  case "$argument" in
    --uid|--gid|--uid=*|--gid=*)
      echo "tar: unrecognized option '$argument'" >&2
      exit 64
      ;;
  esac
done
exec /usr/bin/tar "$@"
`
  );
  chmodSync(tar, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${tarDirectory}:${previousPath}`;
  try {
    const fixture = archiveFixture();
    assert.doesNotThrow(() =>
      archiveIdentity(fixture.archive, fixture.sourceSha)
    );
  } finally {
    process.env.PATH = previousPath;
  }
});

test('accepts only the closed final image config, history, and source binding', () => {
  const fixture = archiveFixture();
  assert.doesNotThrow(() =>
    archiveIdentity(fixture.archive, fixture.sourceSha)
  );
  for (const [variant, error] of [
    ['secret-env', /invalid final image projection/],
    ['extra-env', /invalid final image projection/],
    ['secret-history', /invalid final image history row 1/],
    ['extra-history', /invalid final image history count/],
    ['extra-manifest-key', /invalid image archive manifest/],
  ]) {
    const changed = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(changed.archive, changed.sourceSha),
      error
    );
  }
});

test('scans every projected layer and rejects leaked build artifacts or credentials', () => {
  for (const variant of ['leaked-archive', 'leaked-secret']) {
    const fixture = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(fixture.archive, fixture.sourceSha),
      /unprojected runtime file/
    );
  }
});

test('requires the complete sealed runtime module and receipt projection', () => {
  for (const variant of ['missing-sealed', 'missing-collector']) {
    const fixture = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(fixture.archive, fixture.sourceSha),
      /missing sealed runtime member/
    );
  }
});

test('retains canonical policy-bound provenance receipts', () => {
  const fixture = archiveFixture();
  assert.deepEqual(
    Object.keys(archiveIdentity(fixture.archive, fixture.sourceSha).provenance),
    ['baseTools', 'chrome', 'node', 'ownerCli', 'pnpm', 'runner', 'ubuntu']
  );
  for (const [variant, error] of [
    ['bad-base-binding', /base-tool provenance binding mismatch/],
    ['fake-runner-identity', /provenance receipt policy mismatch/],
  ]) {
    const changed = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(changed.archive, changed.sourceSha),
      error
    );
  }
});

test('requires cp in the retained base-tool receipt', () => {
  const fixture = archiveFixture('missing-cp');
  assert.throws(
    () => archiveIdentity(fixture.archive, fixture.sourceSha),
    /invalid base-tool receipt schema/
  );
});

test('rejects projected symlinks to an unprojected rootfs directory', () => {
  const fixture = archiveFixture('unprojected-link-target');
  assert.throws(
    () => archiveIdentity(fixture.archive, fixture.sourceSha),
    /unprojected tar link target/
  );
});

for (const variant of [
  'mislabeled:var/lib/dpkg/available',
  'mislabeled:var/lib/dpkg/info/google-chrome-stable.postinst',
  'mislabeled:etc/apt/sources.list.d/google-chrome.list',
  'mislabeled:var/cache/apt/pkgcache.bin',
])
  test(`rejects mislabeled package-manager state: ${variant}`, () => {
    const fixture = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(fixture.archive, fixture.sourceSha),
      /forbidden package-manager runtime path/
    );
  });

test('binds every executable role to a canonical image-process-map-v1 receipt', () => {
  const fixture = archiveFixture();
  const identity = archiveIdentity(fixture.archive, fixture.sourceSha);
  assert.equal(identity.processMap.schemaVersion, 1);
  assert.equal(identity.processMap.receiptBinding, 'image-process-map-v1');
  assert.deepEqual(
    identity.processMap.entries.map((entry) => entry.role),
    Object.keys(policy.processAllowSet.executables)
  );
});

test('binds Node provenance to the tar executable, runtime map, and source inventory', () => {
  const fixture = archiveFixture('node-provenance-executable-drift');
  assert.throws(
    () => archiveIdentity(fixture.archive, fixture.sourceSha),
    /node executable provenance mismatch/
  );
});

test('rejects regenerated projections that add files absent from pinned inputs', () => {
  for (const variant of [
    'co-tampered-executable',
    'co-tampered-library',
    'co-tampered-cron',
    'co-tampered-source-inventory-node',
  ]) {
    const fixture = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(fixture.archive, fixture.sourceSha),
      /(?:source inventory|membership mismatch)/
    );
  }
});

test('binds process rows to tar header mode and ownership', () => {
  for (const variant of ['header-mode-drift', 'header-owner-drift']) {
    const fixture = archiveFixture(variant);
    assert.throws(
      () => archiveIdentity(fixture.archive, fixture.sourceSha),
      /(?:process map header drift|rootfs projection archive identity mismatch)/
    );
  }
});

test('accepts a realistic runtime layer above the outer member cap', () => {
  const fixture = archiveFixture('many-layer-members');
  assert.doesNotThrow(() =>
    archiveIdentity(fixture.archive, fixture.sourceSha)
  );
});
