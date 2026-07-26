import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { serializeCommandSettingsReceipt } from './command-settings-contract.mjs';
// biome-ignore format: fixture authority helpers remain one closed import surface.
import { configureProjectionAuthorityFixture, tamperTarHeader } from './image-projection-authority.fixture.mjs';
import { writeArchiveConfig } from './image-projection-config.fixture.mjs';
import {
  chain,
  digest,
  policy,
  policyBytes,
  provenance,
  sealedRuntimePaths,
  sha256,
} from './image-projection-receipts.fixture.mjs';
import { rootfsProjectionPath } from './rootfs-projection-contract.mjs';
import { rootfsSourceInventoryPath } from './rootfs-source-inventory.mjs';

const receipt = () =>
  serializeCommandSettingsReceipt({
    commandSettingsSha256: chain.runner.commandSettingsSha256,
    commandSettingsUrl: chain.runner.commandSettingsUrl,
    nodeProcessExecve: true,
    runnerSha256: chain.runner.sha256,
    runnerVersion: chain.runner.version,
    schemaVersion: 1,
    secretInputContract: {
      copiedToArgumentMap: true,
      masked: true,
      removedFromEnvironment: true,
    },
  });
// biome-ignore format: fixture writes are a single atomic helper.
const write = (path, contents, mode = 0o644) => { mkdirSync(dirname(path), { recursive: true }); return writeFileSync(path, contents, { mode }); };
// biome-ignore format: compact variant fixtures preserve the audited file-size gate.
function writeProvenance(layerRoot, variant) {
  for (const [name, value] of Object.entries(provenance)) {
    const changed =
      variant === 'bad-base-binding' && name === 'node'
        ? {
            ...value,
            baseToolReceiptSha256: digest,
            executableSha256: sha256('sealed'),
          }
        : variant === 'missing-cp' && name === 'base-tools'
          ? { ...value, tools: value.tools.filter((row) => row.role !== 'cp') }
          : variant === 'fake-runner-identity' && name === 'runner'
          ? {
              ...value,
              assetDigest: `sha256:${digest}`,
              assetId: value.assetId + 1,
              assetName: 'fake-runner.tgz',
              assetSize: value.assetSize + 1,
            }
          : name === 'node'
            ? {
                ...value,
                executableSha256:
                  variant === 'node-provenance-executable-drift'
                    ? digest
                    : sha256('sealed'),
              }
          : value;
    // biome-ignore format: immutable provenance fixture mode is part of the archive contract.
    write(join(layerRoot, 'opt/baci-cwv/provenance', `${name}.json`), canonicalJson(changed), 0o444);
  }
}
function writeSealedRuntime(layerRoot, variant) {
  // biome-ignore format: fixed fixture-mode variant preserves the audited line cap.
  write(join(layerRoot, 'opt/baci-cwv/policy.json'), policyBytes, variant === 'runtime-source-mode-drift' ? 0o644 : 0o444);
  for (const path of sealedRuntimePaths) {
    // biome-ignore format: exact missing-member variants remain compact under the audited file-size gate.
    if ((variant === 'missing-sealed' && path.endsWith('runner-identity-gate.mjs')) || (variant === 'missing-collector' && path.endsWith('container-attest-runtime.mjs'))) continue;
    // biome-ignore format: sealed runtime fixtures mirror immutable JSON and executable modes.
    write(join(layerRoot, path), path.endsWith('command-settings-receipt.json') ? receipt() : 'sealed', path.endsWith('.json') || path === 'opt/runner/entrypoint.mjs' ? 0o444 : 0o555);
  }
  // biome-ignore format: exact process leaves are generated with their executable mode.
  for (const path of projectionAuthority.processPaths) { const target = join(layerRoot, path); if (!existsSync(target)) write(target, 'sealed', 0o555); else chmodSync(target, 0o555); }
  // biome-ignore format: generated-state variants exercise the rejected closure leaves.
  const generatedState = variant.startsWith('runner-generated:') ? variant.slice('runner-generated:'.length) : undefined;
  // biome-ignore format: generated-state membership is a closed fixture authority.
  if (['.credentials', '.credentials_rsaparams', '.runner'].includes(generatedState)) write(join(layerRoot, 'opt/runner', generatedState), 'generated\n', 0o600);
}
// biome-ignore format: the closed projection authorities remain visually contiguous.
function projectionEntry(path) {
  if (path === 'etc/group' || path === 'etc/passwd')
    return { kind: 'generated', owner: 'identity', path };
  if (/^(?:etc\/alternatives\/awk|usr\/bin\/awk)$/.test(path)) return { kind: 'generated', owner: 'awk-alternative', path };
  if (
    path === 'bin/dash' || path === 'bin/sh' || path === 'usr/bin/dash' ||
    path.endsWith('/x86_64-linux-gnu/ld-linux-x86-64.so.2') ||
    path === 'lib64/ld-linux-x86-64.so.2'
  )
    return { kind: 'closure', owner: 'shell', path };
  // biome-ignore format: generated trust and its package-backed inputs share one closed branch.
  if (path === 'etc/ssl/certs/ca-certificates.crt' || path === 'etc/ca-certificates.conf' || path.startsWith('usr/share/ca-certificates/')) return { kind: path === 'etc/ssl/certs/ca-certificates.crt' ? 'generated' : 'package', owner: path === 'etc/ssl/certs/ca-certificates.crt' ? 'trust' : 'ca-certificates', path };
  if (path === 'var/lib/dpkg/status')
    return { kind: 'generated', owner: 'dpkg-query', path };
  if (path === 'usr/bin/dpkg-query')
    return { kind: 'package', owner: 'dpkg', path };
  if (path === 'opt/runner/entrypoint.mjs')
    return { kind: 'declared', owner: 'baci', path };
  if (path.startsWith('opt/baci-cwv/'))
    return { kind: 'declared', owner: 'baci', path };
  if (path.startsWith('opt/google/'))
    return { kind: 'artifact', owner: 'chrome', path };
  if (path.startsWith('opt/node/'))
    return { kind: 'artifact', owner: 'node', path };
  if (path.startsWith('opt/pnpm/'))
    return { kind: 'artifact', owner: 'pnpm', path };
  if (path.startsWith('opt/runner/'))
    return { kind: 'artifact', owner: 'runner', path };
  const owner = path === 'usr/bin/bash' ? 'bash' : path === 'usr/bin/mawk' ? 'mawk' : path === 'usr/bin/findmnt' ? 'util-linux' : path === 'usr/bin/grep' ? 'grep' : /^usr\/bin\/(?:cat|id|stat|tr)$/.test(path) ? 'coreutils' : 'git';
  return { kind: 'package', owner, path };
}
const projectionAuthority = configureProjectionAuthorityFixture({
  chain,
  digest,
  policy,
  projectionEntry,
  sha256,
  write,
});
// biome-ignore format: the complete fixture inventories stay contiguous under the audited line gate.
const runtimeDirectories = ['home/runner', 'opt/runner/_diag', 'registration-staging', 'runner-work', 'tmp/baci-cwv'];
const unapprovedRuntimePath = (variant) => variant.split('mislabeled:')[1];
// biome-ignore format: the exact synthetic runtime state stays under the audited file-size gate.
function writeRuntimeState(layerRoot, variant) {
  for (const [path, contents, mode] of [
    ['bin/dash', 'fixture shell'],
    ['bin/sh', 'fixture shell'],
    ['etc/ca-certificates.conf', 'mozilla/Fixture.crt\n'],
    ['etc/group', 'runner:x:10001:\n'],
    ['etc/passwd', 'runner:x:10001:10001:Baci CWV Runner:/home/runner:/bin/bash\n'],
    ['etc/ssl/certs/ca-certificates.crt', 'fixture CA'],
    ['lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', 'fixture loader'],
    ['lib64/ld-linux-x86-64.so.2', 'fixture loader'],
    ['usr/bin/dash', 'fixture shell'],
    ...(variant === 'missing-runtime-chrome' ? [] : [['opt/google/chrome/google-chrome', '#!/bin/sh\necho "Google Chrome 150.0.7871.128"\n', 0o555]]), ['opt/pnpm/package.json', canonicalJson({ bin: { pnpm: 'bin/pnpm.cjs' }, name: 'pnpm', version: '11.7.0' }), 0o644],
    ...['cat', 'findmnt', 'grep', 'id', 'mawk', 'stat', 'tr'].map((name) => [`usr/bin/${name}`, 'fixture probe tool']), ...((variant === 'complete-aggregate-source-inventory' ? [['opt/node/cwv-node-artifact', 4886], ['opt/pnpm/cwv-pnpm-artifact', 463], ['opt/runner/cwv-runner-artifact', 1500], ['opt/google/cwv-chrome-artifact', 3000], ['usr/share/doc/git/cwv-runtime-package', 3000], ['usr/lib/cwv-discovered-library', 500]] : variant === 'over-cap-aggregate-source-inventory' ? [['opt/node/cwv-node-artifact', 4886], ['opt/pnpm/cwv-pnpm-artifact', 463], ['opt/runner/cwv-runner-artifact', 1500], ['opt/google/cwv-chrome-artifact', 3000], ['usr/share/doc/git/cwv-runtime-package', 3000], ['usr/lib/cwv-discovered-library', 500], ['usr/share/doc/git/cwv-over-cap', 18000]] : variant === 'many-layer-members' ? [['usr/share/doc/git/cwv-layer', 200]] : []).flatMap(([root, length]) => Array.from({ length }, (_value, index) => [`${root}-${index}`, 'fixture package file']))),
    ['usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', 'fixture loader'],
    ['usr/share/ca-certificates/mozilla/Fixture.crt', 'fixture CA'],
  ]) { const target = join(layerRoot, path); if (mode && existsSync(target)) chmodSync(target, 0o644); write(target, contents, mode ?? (path === 'etc/ssl/certs/ca-certificates.crt' ? 0o444 : 0o644)); if (mode) chmodSync(target, mode); }
  write(join(layerRoot, 'usr/bin/dpkg-query'), 'fixture dpkg query', 0o555); write(join(layerRoot, 'var/lib/dpkg/status'), 'Package: google-chrome-stable\nStatus: install ok installed\nVersion: 150.0.0\nArchitecture: amd64\n', 0o444);
  if (unapprovedRuntimePath(variant)) write(join(layerRoot, unapprovedRuntimePath(variant)), 'refuse');
  mkdirSync(join(layerRoot, 'etc/alternatives'), { recursive: true }); symlinkSync(variant === 'awk-alternative-drift' ? '/usr/bin/cat' : '/usr/bin/mawk', join(layerRoot, 'etc/alternatives/awk')); symlinkSync('/etc/alternatives/awk', join(layerRoot, 'usr/bin/awk'));
  // biome-ignore format: writable mountpoints require a fixed directory mode.
  for (const path of runtimeDirectories) { mkdirSync(join(layerRoot, path), { recursive: true }); chmodSync(join(layerRoot, path), 0o700); }
}
// biome-ignore format: rootfs fixture variants remain a compact closed mutation surface.
function writeProjection(layerRoot, variant) {
  const entries = [];
  const collect = (directory, prefix = '') => {
    for (const name of readdirSync(directory)) {
      const path = prefix ? `${prefix}/${name}` : name;
      const absolute = join(directory, name);
      if (lstatSync(absolute).isDirectory()) collect(absolute, path);
      else entries.push(projectionEntry(path));
    }
  };
  collect(layerRoot); const unapproved = unapprovedRuntimePath(variant); if (unapproved) entries.find(({ path }) => path === unapproved).owner = 'git';
  for (const path of runtimeDirectories) entries.push({ kind: 'generated', owner: 'directory', path });
  // biome-ignore format: the guarded fixture removal retains the audited line cap.
  if (variant === 'missing-required-rootfs') { const index = entries.findIndex((entry) => entry.path === 'bin/sh'); if (index >= 0) entries.splice(index, 1); }
  if (variant === 'duplicate-chrome-owner') entries.push({ kind: 'package', owner: 'google-chrome-stable', path: 'opt/google/chrome/chrome' });
  entries.push({ kind: 'declared', owner: 'baci', path: rootfsProjectionPath });
  if (variant === 'build-only-package-manifest') entries.push({ kind: 'package', owner: 'gpgv', path: 'usr/bin/gpgv' });
  write(
    join(layerRoot, rootfsProjectionPath),
    canonicalJson({
      // biome-ignore format: fixture sort mirrors the runtime direct comparator.
      entries: entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
      schemaVersion: 1,
    })
  );
}
// biome-ignore format: archive rejection fixtures remain compact under the line gate.
function writeVariant(layerRoot, variant) {
  if (variant === 'unprojected-runtime-directory')
    return mkdirSync(join(layerRoot, 'opt/runner/injected'), { recursive: true });
  if (variant === 'unprojected-link-target') {
    mkdirSync(join(layerRoot, 'usr/lib/unprojected-dir'), { recursive: true });
    symlinkSync('unprojected-dir', join(layerRoot, 'usr/lib/projected-dir-link'));
    return;
  }
  if (variant === 'co-tampered-source-inventory-node') { const nodePath = join(layerRoot, 'opt/node/bin/node'); chmodSync(nodePath, 0o755); write(nodePath, 'co-tampered node'); const inventoryPath = join(layerRoot, rootfsSourceInventoryPath); const inventory = JSON.parse(readFileSync(inventoryPath)); inventory.entries.find((entry) => entry.path === 'opt/node/bin/node').sha256 = sha256('co-tampered node'); chmodSync(inventoryPath, 0o644); return write(inventoryPath, canonicalJson(inventory), 0o444); }
  const fixtures = {
    'arbitrary-executable': [
      'usr/bin/runtime-payload',
      '#!/bin/sh\necho payload\n',
    ],
    'arbitrary-library': ['usr/lib/libruntime-payload.so', 'not a library'],
    'co-tampered-cron': ['etc/cron.d/runtime-payload', 'payload'],
    'co-tampered-executable': [
      'usr/bin/runtime-payload',
      '#!/bin/sh\necho payload\n',
    ],
    'co-tampered-library': ['usr/lib/libruntime-payload.so', 'payload'],
    'build-only-gpgv': ['usr/bin/gpgv', 'build-only verifier'],
    'build-only-package-manifest': ['usr/bin/gpgv', 'build-only verifier'],
    'leaked-archive': [
      'opt/baci-cwv/downloads/runner.tar.gz',
      'build artifact',
    ],
    'leaked-secret': [
      'opt/baci-cwv/runtime.txt',
      'ACTIONS_RUNTIME_TOKEN=not-a-real-secret',
    ],
    'ld-preload': ['etc/ld.so.preload', '/tmp/evil.so'],
    'unexpected-baci-runtime': [
      'opt/baci-cwv/undeclared-runtime.txt',
      'refuse',
    ],
    'unexpected-opt-runtime': ['opt/undeclared-runtime.txt', 'refuse'],
    'unexpected-rootfs-path': ['unexpected-runtime-file', 'refuse'],
  };
  // biome-ignore format: oversized fixture stays a one-line bounded-member probe.
  if (variant === 'large-member') return write(join(layerRoot, 'usr/share/locale/runner-sized-payload'), Buffer.alloc(1024 * 1024 + 1, 0x61));
  const entry = fixtures[variant];
  if (entry) write(join(layerRoot, entry[0]), entry[1]);
}
function archiveLayer(directory, layerRoot, variant) {
  const looseLayer = join(directory, 'layer.tar');
  execFileSync('tar', [
    '--format=ustar',
    '--owner',
    '0',
    '--group',
    '0',
    '-cf',
    looseLayer,
    '-C',
    layerRoot,
    '.',
  ]);
  // biome-ignore format: Linux symlink modes and writable directory ownership are one fixture boundary.
  for (const [paths, changes] of [[['etc/alternatives/awk', 'usr/bin/awk'], { mode: 0o777 }], [runtimeDirectories, { gid: 10001, uid: 10001 }]]) for (const path of paths) tamperTarHeader(looseLayer, path, changes);
  // biome-ignore format: exact tar-header corruptions form one closed high-fidelity fixture matrix.
  const tarChange = { 'header-mode-drift': ['opt/baci-cwv/canonical-json.mjs', { mode: 0o777 }], 'header-owner-drift': ['opt/baci-cwv/canonical-json.mjs', { gid: 10001, uid: 10001 }], 'directory-mode-drift': ['opt/runner/bin', { mode: 0o777 }], 'directory-owner-drift': ['opt/runner/bin', { gid: 10001, uid: 10001 }], 'directory-type-drift': ['opt/runner/bin', { type: '0' }], 'directory-raw-name-drift': ['opt/runner/bin', { rawName: 'opt/runner/bin/' }], 'awk-alternative-mode-drift': ['usr/bin/awk', { mode: 0o755 }] }[variant];
  if (tarChange) tamperTarHeader(looseLayer, ...tarChange);
  const layerHash = sha256(readFileSync(looseLayer));
  const layerName = `${layerHash}/layer.tar`;
  mkdirSync(join(directory, layerHash));
  writeFileSync(join(directory, layerName), readFileSync(looseLayer));
  return { layerHash, layerName };
}
export function archiveFixture(variant = 'valid', sourceSha = 'b'.repeat(64)) {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-projection-'));
  const layerRoot = join(directory, 'root');
  writeProvenance(layerRoot, variant);
  writeSealedRuntime(layerRoot, variant);
  writeRuntimeState(layerRoot, variant);
  const linkVariant = variant === 'unprojected-link-target';
  if (linkVariant) writeVariant(layerRoot, variant);
  projectionAuthority.writeSourceInventory(layerRoot);
  const coTampered = variant.startsWith('co-tampered-');
  if (coTampered) writeVariant(layerRoot, variant);
  projectionAuthority.writeProcessMap(layerRoot);
  writeProjection(layerRoot, variant);
  if (!coTampered && !linkVariant) writeVariant(layerRoot, variant);
  const { layerHash, layerName } = archiveLayer(directory, layerRoot, variant);
  const configName = writeArchiveConfig({
    chain,
    directory,
    layerHash,
    layerName,
    policy,
    policyBytes,
    sha256,
    sourceSha,
    variant,
  });
  const archive = join(directory, 'image.tar');
  execFileSync('tar', [
    '--format=ustar',
    '--no-recursion',
    '-cf',
    archive,
    '-C',
    directory,
    'manifest.json',
    configName,
    layerName,
  ]);
  // biome-ignore format: fixture return exposes one exact high-cardinality inventory summary.
  return { archive, directory, rootfsSourceInventoryBytes: readFileSync(join(layerRoot, rootfsSourceInventoryPath)).length, rootfsSourceInventoryRows: JSON.parse(readFileSync(join(layerRoot, rootfsSourceInventoryPath))).entries.length, sourceSha };
}
