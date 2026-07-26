// biome-ignore-all format: compact fixed bootstrap runtime test stays below the file limit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  fstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as bootstrap from './task9-bootstrap.mjs';
import {
  assertTask9SourceFiles,
  TASK9_SOURCE_FILES,
} from './task9-bootstrap.mjs';
import {
  assertPinnedExecution,
  parseLauncherArgs,
  readBundleFiles,
} from './task9-bootstrap-runtime.mjs';
import { createExactBootstrapBundle } from './task9-bootstrap-runtime-fixture.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const owner = process.getuid();
const entries = [
  ['manifest.json', '100400'],
  ['manifest.sha256', '100400'],
  ['source.tar', '100400'],
  ['source.tar.sha256', '100400'],
  ['task9-bootstrap.mjs', '100400'],
  ['node', '100500'],
  ['node-provenance.json', '100400'],
];

function bundle() {
  const root = mkdtempSync(join(tmpdir(), 'task9-bundle-'));
  for (const [name, mode] of entries) {
    const path = join(root, name);
    writeFileSync(path, `${name}\n`, {
      mode: Number.parseInt(mode.slice(3), 8),
    });
    chmodSync(path, Number.parseInt(mode.slice(3), 8));
  }
  return root;
}

test('has a closed offline bootstrap CLI and rejects malformed invocation', () => {
  assert.throws(() => parseLauncherArgs([]), /invocation/);
  assert.throws(() => parseLauncherArgs(['--authorize']), /invocation/);
  const parsed = parseLauncherArgs(['--authorize', '--bundle-id', 'bundle', '--reviewed-envelope-sha256', 'a'.repeat(64), '--reviewed-launcher-sha256', 'b'.repeat(64), '--bundle-dir', '/transaction/task9-bundle', '--envelope', '/envelope', '--envelope-sha256', '/envelope.sha256', '--owner', '0']);
  assert.equal(parsed.envelopeSha256Path, '/envelope.sha256');
  assert.equal(parsed.publishDir, '/transaction/authorized-source');
  assert.equal('envelopeSha256' in parsed, false);
  assert.throws(() => parseLauncherArgs([...['--authorize', '--bundle-id', 'bundle', '--reviewed-envelope-sha256', 'a'.repeat(64), '--reviewed-launcher-sha256', 'b'.repeat(64), '--bundle-dir', '/transaction/task9-bundle', '--envelope', '/envelope', '--envelope-sha256', '/envelope.sha256', '--owner', '0'], '--publish-dir', '/alternate']), /invocation/);
  const result = spawnSync(process.execPath, ['task9-bootstrap-runtime.mjs'], {
    cwd: new URL('.', import.meta.url),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refused/);
});

test('recognizes the relocated reviewed launcher by module identity, not basename', () => {
  const source = readFileSync(
    new URL('./task9-bootstrap-runtime.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /same\(lstatSync\(resolve\(process\.argv\[1\]\)\),\s*lstatSync\(fileURLToPath\(import\.meta\.url\)\)\)/);
  assert.doesNotMatch(source, /endsWith\(['"]\/task9-bootstrap-runtime\.mjs/);
});

test('does not initialize the application before first-stage verification', () => {
  const source = readFileSync(new URL('./task9-bootstrap-runtime.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"]\.\/task9-bootstrap\.mjs['"]/);
  assert.match(source, /reviewed-launcher-sha256/);
  assert.match(source, /data:text\/javascript;base64/);
  const reviewedPayload = source.indexOf('reviewedPayload');
  const dynamicImport = source.indexOf('await import');
  assert.notEqual(reviewedPayload, -1);
  assert.notEqual(dynamicImport, -1);
  assert.ok(reviewedPayload < dynamicImport);
  const application = readFileSync(new URL('./task9-bootstrap.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(application.slice(application.indexOf('export function runBootstrapCli'), application.indexOf("if(process.argv[1]?.endsWith('/task9-bootstrap.mjs')")), /withPinnedTask9Execution|process\.execPath|process\.argv\[1\]/);
});

test('owner bootstrap invokes the separately reviewed launcher', () => {
  const source = readFileSync(new URL('./owner-dispatch.sh', import.meta.url), 'utf8');
  assert.match(source, /TASK9_SOURCES=.*task9-bootstrap-runtime\.mjs/);
  assert.match(source, /--reviewed-launcher-sha256/);
  assert.match(source, /"\$node" "\$launcher" --authorize/);
  assert.doesNotMatch(source, /"\$node" "\$bootstrap" --authorize/);
});

test('reads only the exact regular owned bundle with observed modes', () => {
  const root = bundle();
  try {
    const files = readBundleFiles(root, owner);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(files).map(([name, row]) => [
          name,
          [row.mode, row.owner, row.symlink],
        ])
      ),
      Object.fromEntries(
        entries.map(([name, mode]) => [name, [mode, owner, false]])
      )
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('rejects added files, links, and noncanonical bundle metadata', () => {
  const root = bundle();
  try {
    writeFileSync(join(root, 'extra'), 'no');
    assert.throws(() => readBundleFiles(root, owner), /invalid invocation/);
    rmSync(join(root, 'extra'));
    symlinkSync(join(root, 'manifest.json'), join(root, 'extra'));
    assert.throws(() => readBundleFiles(root, owner), /invalid invocation/);
    rmSync(join(root, 'extra'));
    chmodSync(join(root, 'node'), 0o400);
    assert.throws(() => readBundleFiles(root, owner), /invalid invocation/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('pins the actual node and executing bootstrap bytes', () => {
  const node = Buffer.from('node');
  const bootstrap = Buffer.from('bootstrap');
  const launcher = Buffer.from('launcher');
  const runtime = {
    bootstrapSha256: digest(bootstrap),
    launcherSha256: digest(launcher),
    nodeProvenanceSha256: 'a'.repeat(64),
    nodeSha256: digest(node),
    nodeVersion: process.version,
    runtimeSha256: 'b'.repeat(64),
  };
  assert.doesNotThrow(() =>
    assertPinnedExecution(runtime, {
      bootstrapBytes: bootstrap,
      launcherBytes: launcher,
      nodeBytes: node,
    })
  );
  assert.throws(
    () =>
      assertPinnedExecution(runtime, {
        bootstrapBytes: Buffer.from('changed'),
        launcherBytes: launcher,
        nodeBytes: node,
      }),
    /invalid invocation/
  );
  const names = Object.keys(runtime).sort();
  const aliases = new Proxy(runtime, { getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }), ownKeys: () => [`${names[0]},${names[1]}`, ...names.slice(2)] });
  assert.throws(() => assertPinnedExecution(aliases, { bootstrapBytes: bootstrap, launcherBytes: launcher, nodeBytes: node }), /invalid invocation/);
});

test('exposes descriptor-held execution for the pinned bootstrap and Node', () => {
  assert.equal(typeof bootstrap.withPinnedTask9Execution, 'function');
});

test('keeps both pinned executable descriptors open through the execution callback', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-held-execution-'));
  try {
    const bootstrapPath = join(root, 'task9-bootstrap.mjs');
    const nodePath = join(root, 'node');
    writeFileSync(bootstrapPath, 'bootstrap', { mode: 0o400 });
    writeFileSync(nodePath, 'node', { mode: 0o500 });
    let descriptors;
    bootstrap.withPinnedTask9Execution(
      {
        bootstrapSha256: digest(Buffer.from('bootstrap')),
        nodeSha256: digest(Buffer.from('node')),
      },
      { bootstrapPath, nodePath, owner },
      (value) => {
        descriptors = value.descriptors;
        assert.equal(fstatSync(descriptors.bootstrap).isFile(), true);
        assert.equal(fstatSync(descriptors.node).isFile(), true);
        renameSync(bootstrapPath, `${bootstrapPath}.replaced`);
        renameSync(nodePath, `${nodePath}.replaced`);
        assert.equal(fstatSync(descriptors.bootstrap).size, 9);
        assert.equal(fstatSync(descriptors.node).size, 4);
      }
    );
    assert.throws(() => fstatSync(descriptors.bootstrap), /bad file descriptor/i);
    assert.throws(() => fstatSync(descriptors.node), /bad file descriptor/i);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('requires the exact sorted source authorization rows', () => {
  const rows = TASK9_SOURCE_FILES.map((path) => ({
    path,
    sha256: 'a'.repeat(64),
  }));
  assert.doesNotThrow(() => assertTask9SourceFiles(rows));
  assert.throws(() => assertTask9SourceFiles(rows.slice(1)), /source archive/);
  assert.throws(
    () =>
      assertTask9SourceFiles([
        ...rows,
        {
          path: 'infra/cwv-runner/unexpected.mjs',
          sha256: 'a'.repeat(64),
        },
      ]),
    /source archive/
  );
  assert.throws(
    () => assertTask9SourceFiles([...rows, rows.at(-1)]),
    /source archive/
  );
  const unsorted = [...rows];
  [unsorted[0], unsorted[1]] = [unsorted[1], unsorted[0]];
  assert.throws(() => assertTask9SourceFiles(unsorted), /source archive/);
});

test('requires the Task 1 rootfs, source-tree, and terminal-cleanup closure in the sealed source inventory', () => { for (const path of 'infra/cwv-runner/archive-index.mjs infra/cwv-runner/exact-run-terminal-cleanup.sh infra/cwv-runner/rootfs-source-membership-input.mjs infra/cwv-runner/rootfs-source-membership.mjs infra/cwv-runner/source-tree-projection.mjs'.split(' ')) assert.ok(TASK9_SOURCE_FILES.includes(path), path); assert.deepEqual([...TASK9_SOURCE_FILES].sort(), TASK9_SOURCE_FILES); });

test('executes only the relocated pinned pair and atomically publishes a sealed tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-relocated-'));
  try {
    const value = createExactBootstrapBundle(root);
    const args = [
      '--authorize',
      '--bundle-id',
      value.bundleId,
      '--reviewed-envelope-sha256',
      value.envelopeSha256,
      '--reviewed-launcher-sha256',
      value.launcherSha256,
      '--bundle-dir',
      value.bundleDir,
      '--envelope',
      value.envelopePath,
      '--envelope-sha256',
      value.digestPath,
      '--owner',
      String(owner),
    ];
    assert.equal(typeof value.launcher, 'string');
    const result = spawnSync(value.node, [value.launcher, ...args], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(value.publishDir, 'receipt.json'), 'utf8'), /task9-exact-run/);
    for (const name of 'archive-index.mjs canonical-json.mjs rootfs-source-membership.mjs rootfs-source-membership-input.mjs source-tree-projection.mjs'.split(' ')) {
      const published = join(value.publishDir, 'infra/cwv-runner', name);
      assert.deepEqual(readFileSync(published), readFileSync(new URL(`./${name}`, import.meta.url)), name);
      const imported = spawnSync(value.node, [published], { encoding: 'utf8' });
      assert.equal(imported.status, 0, `${name}: ${imported.stderr}`);
    }
    for (const name of 'registration-root-restoration.mjs root-runtime-post-egress-recovery.mjs'.split(' ')) assert.equal(existsSync(join(value.publishDir, 'infra/cwv-runner', name)), true, name);
    const sourceManifest = spawnSync(value.node, [join(value.publishDir, 'infra/cwv-runner/source-manifest.mjs')], { encoding: 'utf8' });
    assert.doesNotMatch(`${sourceManifest.stdout}${sourceManifest.stderr}`, /ERR_MODULE_NOT_FOUND/);
    const controller = spawnSync('/bin/sh', [join(value.publishDir, 'infra/cwv-runner/exact-run-controller.sh'), '--invalid'], { encoding: 'utf8' });
    assert.equal(controller.status, 64, controller.stderr);
    assert.deepEqual(readdirSync(root).filter((name) => name.includes('.authorized-source.tmp-')), []);
    const staleReview = [...args];
    staleReview[4] = '0'.repeat(64);
    assert.notEqual(spawnSync(value.node, [value.launcher, ...staleReview], { encoding: 'utf8' }).status, 0);
    assert.equal(existsSync(join(root, 'rejected-review')), false);
    chmodSync(join(value.bundleDir, 'task9-bootstrap.mjs'), 0o600);
    const rejected = spawnSync(value.node, [value.launcher, ...args], { encoding: 'utf8' });
    assert.notEqual(rejected.status, 0);
    chmodSync(join(value.bundleDir, 'task9-bootstrap.mjs'), 0o600);
    const marker = join(root, 'untrusted-module-initialized');
    writeFileSync(join(value.bundleDir, 'task9-bootstrap.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'bad');`, { mode: 0o400 });
    chmodSync(join(value.bundleDir, 'task9-bootstrap.mjs'), 0o400);
    assert.notEqual(spawnSync(value.node, [value.launcher, ...args], { encoding: 'utf8' }).status, 0);
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
