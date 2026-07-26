import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  imageProcessMap,
  sealedPaths,
  validateImageProcessMap,
  writeImageProcessMap,
} from './image-process-map.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const source = readFileSync(
  new URL('image-process-map.mjs', import.meta.url),
  'utf8'
);

const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('policy.json', import.meta.url), 'utf8'))
);

function createFixture() {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'baci-cwv-process-map-'));
  const root = realpathSync(temporaryRoot);
  const output = join(root, 'opt/baci-cwv/image-process-map.json');
  for (const path of new Set([
    ...sealedPaths,
    ...Object.values(policy.processAllowSet.executables).map(
      ({ path }) => path
    ),
  ])) {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, path);
    chmodSync(target, 0o555);
  }
  return { output, root, temporaryRoot };
}

test('reads every sealed member once through a no-follow descriptor', () => {
  assert.match(source, /constants\.O_RDONLY\s*\|\s*constants\.O_NOFOLLOW/);
  assert.match(source, /fstatSync\(descriptor\)/);
  assert.match(source, /readFileSync\(descriptor\)/);
  assert.match(source, /closeSync\(descriptor\)/);
  assert.doesNotMatch(source, /statSync\(realpath\)|readFileSync\(realpath\)/);
  assert.equal(Object.isFrozen(sealedPaths), true);
  assert.ok(sealedPaths.includes('/opt/baci-cwv/container-attest-runtime.mjs'));
});

test('binds the runtime collector read-only mode and exact bytes', () => {
  const { root, temporaryRoot } = createFixture();
  try {
    const collector = imageProcessMap(policy, root).sealed.find(
      ({ path }) => path === '/opt/baci-cwv/container-attest-runtime.mjs'
    );
    assert.equal(collector.mode, '0555');
    assert.equal(
      collector.sha256,
      createHash('sha256')
        .update('/opt/baci-cwv/container-attest-runtime.mjs')
        .digest('hex')
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('keeps the prior image process map readable until atomic replacement succeeds', () => {
  const { output, root, temporaryRoot } = createFixture();
  try {
    writeFileSync(output, 'old map');
    let observed;
    writeImageProcessMap(policy, output, root, {
      replace(temporaryPath, destinationPath) {
        observed = readFileSync(destinationPath, 'utf8');
        renameSync(temporaryPath, destinationPath);
      },
    });
    assert.equal(observed, 'old map');
    assert.equal(
      readFileSync(output, 'utf8'),
      canonicalJson(imageProcessMap(policy, root))
    );
    assert.equal(existsSync(`${output}.${process.pid}.tmp`), false);
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('preserves the prior image process map and removes its temporary file when replacement fails', () => {
  const { output, root, temporaryRoot } = createFixture();
  try {
    writeFileSync(output, 'old map');
    assert.throws(
      () =>
        writeImageProcessMap(policy, output, root, {
          replace() {
            throw new Error('forced replacement failure');
          },
        }),
      /forced replacement failure/
    );
    assert.equal(readFileSync(output, 'utf8'), 'old map');
    assert.equal(
      readdirSync(join(root, 'opt/baci-cwv')).some((entry) =>
        entry.endsWith('.tmp')
      ),
      false
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('rejects unknown executable roles from an otherwise canonical map', () => {
  const { root, temporaryRoot } = createFixture();
  try {
    const map = imageProcessMap(policy, root);
    map.entries[0].role = 'unapproved-role';
    assert.throws(
      () => validateImageProcessMap(map, policy),
      /image process entry/
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test('rejects writable or non-root process authority rows', () => {
  const { root, temporaryRoot } = createFixture();
  try {
    for (const [section, field, value] of [
      ['entries', 'mode', '0777'],
      ['entries', 'owner', '10001:10001'],
      ['sealed', 'mode', '0666'],
      ['sealed', 'owner', '10001:10001'],
    ]) {
      const map = imageProcessMap(policy, root);
      for (const entry of [...map.entries, ...map.sealed]) {
        entry.realpath = entry.path;
        entry.owner = '0:0';
      }
      assert.doesNotThrow(() => validateImageProcessMap(map, policy));
      map[section][0][field] = value;
      assert.throws(
        () => validateImageProcessMap(map, policy),
        /(?:image|sealed)/
      );
    }
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});
