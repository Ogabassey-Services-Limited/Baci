import assert from 'node:assert/strict';
import test from 'node:test';

import { archiveIdentity } from './build-image.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';

const rejects = (variant) => {
  const fixture = archiveFixture(variant);
  assert.throws(() => archiveIdentity(fixture.archive, fixture.sourceSha));
};

test('rejects arbitrary rootfs data, executables, libraries, and build-only tools', () => {
  for (const variant of [
    'large-member',
    'arbitrary-executable',
    'arbitrary-library',
    'build-only-gpgv',
    'build-only-package-manifest',
  ]) {
    rejects(variant);
  }
});

test('rejects unreferenced rootfs paths and ld preload', () => {
  for (const variant of [
    'unexpected-rootfs-path',
    'unexpected-baci-runtime',
    'unexpected-opt-runtime',
    'ld-preload',
  ]) {
    rejects(variant);
  }
});

test('rejects incomplete closure and duplicate Chrome ownership', () => {
  for (const variant of ['missing-required-rootfs', 'duplicate-chrome-owner'])
    rejects(variant);
});

test('rejects noncanonical, non-directory, or writable sealed runtime ancestors', () => {
  for (const variant of [
    'directory-mode-drift',
    'directory-owner-drift',
    'directory-type-drift',
    'directory-raw-name-drift',
    'unprojected-runtime-directory',
  ])
    rejects(variant);
});

test('accepts only the exact Ubuntu awk alternatives chain', () => {
  const accepted = archiveFixture();
  assert.doesNotThrow(() =>
    archiveIdentity(accepted.archive, accepted.sourceSha)
  );
  rejects('awk-alternative-drift');
  rejects('awk-alternative-mode-drift');
});

test('accepts the complete aggregate source inventory within its dedicated bound', () => {
  const baseline = archiveFixture();
  const fixture = archiveFixture('complete-aggregate-source-inventory');
  // The injected entrypoint and two generated awk links are not source rows.
  assert.equal(
    fixture.rootfsSourceInventoryRows - baseline.rootfsSourceInventoryRows,
    13_349
  );
  assert.ok(fixture.rootfsSourceInventoryBytes > 2 * 1024 * 1024);
  assert.ok(fixture.rootfsSourceInventoryBytes <= 8 * 1024 * 1024);
  assert.ok(fixture.rootfsSourceInventoryBytes * 2 <= 8 * 1024 * 1024);
  assert.doesNotThrow(() =>
    archiveIdentity(fixture.archive, fixture.sourceSha)
  );
});

test('rejects a complete aggregate source inventory above its dedicated bound', () => {
  const fixture = archiveFixture('over-cap-aggregate-source-inventory');
  assert.ok(fixture.rootfsSourceInventoryBytes > 8 * 1024 * 1024);
  assert.throws(
    () => archiveIdentity(fixture.archive, fixture.sourceSha),
    /sealed archive member exceeds maximum size/
  );
});
