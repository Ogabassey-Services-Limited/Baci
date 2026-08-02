// biome-ignore-all format: the separately reviewed first-stage stays below the repository file limit
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_ENTRIES = Object.freeze(['manifest.json', 'manifest.sha256', 'source.tar', 'source.tar.sha256', 'task9-bootstrap.mjs', 'node', 'node-provenance.json']);
const MODES = Object.freeze({ 'manifest.json': '100400', 'manifest.sha256': '100400', 'source.tar': '100400', 'source.tar.sha256': '100400', 'task9-bootstrap.mjs': '100400', node: '100500', 'node-provenance.json': '100400' });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = () => {
  throw new Error('invalid invocation');
};
const object = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const sameKeys = (actual, expected) => actual.length === expected.length && actual.every((key, index) => key === expected[index]);
const exact = (value, keys) =>
  object(value) &&
  sameKeys(Object.keys(value).sort(), [...keys].sort());
const digest = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (left, right) =>
  left.dev === right.dev && left.ino === right.ino;

function canonicalJson(value) {
  if (
    value === null ||
    ['string', 'boolean'].includes(typeof value) ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!object(value)) fail();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

function held(path, owner, mode) {
  const before = lstatSync(path);
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    before.uid !== owner ||
    before.mode.toString(8) !== mode
  )
    fail();
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || !same(before, stat) || stat.uid !== owner) fail();
    const bytes = Buffer.alloc(stat.size);
    for (let offset = 0; offset < bytes.length; ) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      if (count < 1) fail();
      offset += count;
    }
    if (!same(stat, lstatSync(path))) fail();
    return { bytes, descriptor, mode, owner, symlink: false };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  }
}

function assertDirectory(path, owner) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory() || stat.uid !== owner) fail();
}

export function readBundleFiles(bundleDir, owner) {
  assertDirectory(bundleDir, owner);
  if (!sameKeys(readdirSync(bundleDir).sort(), [...BUNDLE_ENTRIES].sort()))
    fail();
  return Object.fromEntries(
    BUNDLE_ENTRIES.map((name) => {
      const row = held(join(bundleDir, name), owner, MODES[name]);
      closeSync(row.descriptor);
      return [name, {
        bytes: row.bytes,
        mode: row.mode,
        owner: row.owner,
        symlink: false,
      }];
    })
  );
}

function heldBundle(bundleDir, owner, heldFiles) {
  assertDirectory(bundleDir, owner);
  if (!sameKeys(readdirSync(bundleDir).sort(), [...BUNDLE_ENTRIES].sort()))
    fail();
  return Object.fromEntries(
    BUNDLE_ENTRIES.map((name) => {
      const row = held(join(bundleDir, name), owner, MODES[name]);
      heldFiles.push(row);
      return [name, row];
    })
  );
}

export function assertPinnedExecution(runtime, files) {
  if (
    !exact(runtime, [
      'bootstrapSha256',
      'launcherSha256',
      'nodeProvenanceSha256',
      'nodeSha256',
      'nodeVersion',
      'runtimeSha256',
    ]) ||
    ![runtime.bootstrapSha256, runtime.launcherSha256, runtime.nodeProvenanceSha256, runtime.nodeSha256, runtime.runtimeSha256].every(digest) ||
    !/^v?\d+\.\d+\.\d+$/.test(runtime.nodeVersion) ||
    !files ||
    !Buffer.isBuffer(files.bootstrapBytes) ||
    !Buffer.isBuffer(files.launcherBytes) ||
    !Buffer.isBuffer(files.nodeBytes) ||
    hash(files.bootstrapBytes) !== runtime.bootstrapSha256 ||
    hash(files.launcherBytes) !== runtime.launcherSha256 ||
    hash(files.nodeBytes) !== runtime.nodeSha256
  )
    fail();
}

function document(bytes) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (canonicalJson(value) !== bytes.toString('utf8')) fail();
  return value;
}

function reviewedPayload(envelope, files) {
  if (
    envelope?.bundleId === undefined ||
    !exact(envelope.payload, ['entries']) ||
    !Array.isArray(envelope.payload.entries) ||
    envelope.payload.entries.length !== BUNDLE_ENTRIES.length
  )
    fail();
  const names = [...BUNDLE_ENTRIES].sort();
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    const row = envelope.payload.entries[index];
    if (
      !exact(row, ['mode', 'path', 'sha256', 'type']) ||
      row.path !== `payload/${name}` ||
      row.mode !== MODES[name] ||
      row.type !== 'file' ||
      row.sha256 !== hash(files[name].bytes)
    )
      fail();
  }
}

export function parseLauncherArgs(argv) {
  if (
    argv.length !== 15 ||
    argv[0] !== '--authorize' ||
    argv[1] !== '--bundle-id' ||
    argv[3] !== '--reviewed-envelope-sha256' ||
    argv[5] !== '--reviewed-launcher-sha256' ||
    argv[7] !== '--bundle-dir' ||
    argv[9] !== '--envelope' ||
    argv[11] !== '--envelope-sha256' ||
    argv[13] !== '--owner'
  )
    fail();
  const owner = Number(argv[14]);
  if (
    !Number.isSafeInteger(owner) ||
    owner < 0 ||
    !digest(argv[4]) ||
    !digest(argv[6]) ||
    ![argv[2], argv[8], argv[10], argv[12]].every(
      (value) => typeof value === 'string' && value.length > 0
    )
  )
    fail();
  return {
    bundleDir: resolve(argv[8]),
    bundleId: argv[2],
    envelope: resolve(argv[10]),
    envelopeSha256Path: resolve(argv[12]),
    owner,
    publishDir: join(dirname(resolve(argv[8])), 'authorized-source'),
    reviewedEnvelopeSha256: argv[4],
    reviewedLauncherSha256: argv[6],
  };
}

export async function launchTask9Bootstrap(argv) {
  const args = parseLauncherArgs(argv);
  if (process.getuid() !== args.owner) fail();
  const heldFiles = [];
  try {
    const launcher = held(resolve(process.argv[1]), args.owner, '100400');
    heldFiles.push(launcher);
    const files = heldBundle(args.bundleDir, args.owner, heldFiles);
    const loadedNode = held(resolve(process.execPath), args.owner, '100500');
    heldFiles.push(loadedNode);
    if (
      !same(fstatSync(loadedNode.descriptor), fstatSync(files.node.descriptor)) ||
      !same(lstatSync(resolve(process.argv[0])), fstatSync(files.node.descriptor))
    )
      fail();
    const envelope = held(args.envelope, args.owner, '100400');
    const envelopeDigest = held(args.envelopeSha256Path, args.owner, '100400');
    heldFiles.push(envelope, envelopeDigest);
    if (
      hash(launcher.bytes) !== args.reviewedLauncherSha256 ||
      hash(envelope.bytes) !== args.reviewedEnvelopeSha256 ||
      envelopeDigest.bytes.toString('ascii') !==
        `${args.reviewedEnvelopeSha256}\n`
    )
      fail();
    const parsed = document(envelope.bytes);
    if (parsed.bundleId !== args.bundleId) fail();
    reviewedPayload(parsed, files);
    if (!exact(parsed.source, ['archiveSha256', 'manifestSha256']) || parsed.source.archiveSha256 !== hash(files['source.tar'].bytes) || parsed.source.manifestSha256 !== hash(files['manifest.json'].bytes)) fail();
    if (files['manifest.sha256'].bytes.toString('ascii') !== `${parsed.source.manifestSha256}  manifest.json\n` || files['source.tar.sha256'].bytes.toString('ascii') !== `${parsed.source.archiveSha256}  source.tar\n`)
      fail();
    if (parsed.runtime.nodeProvenanceSha256 !== hash(files['node-provenance.json'].bytes))
      fail();
    assertPinnedExecution(parsed.runtime, {
      bootstrapBytes: files['task9-bootstrap.mjs'].bytes,
      launcherBytes: launcher.bytes,
      nodeBytes: files.node.bytes,
    });
    if (parsed.runtime.launcherSha256 !== args.reviewedLauncherSha256) fail();
    const runtimeBytes = Buffer.from(
      canonicalJson({
        bootstrapSha256: parsed.runtime.bootstrapSha256,
        launcherSha256: parsed.runtime.launcherSha256,
        nodeProvenanceSha256: parsed.runtime.nodeProvenanceSha256,
        nodeSha256: parsed.runtime.nodeSha256,
        nodeVersion: parsed.runtime.nodeVersion,
      })
    );
    if (hash(runtimeBytes) !== parsed.runtime.runtimeSha256) fail();
    const source = files['task9-bootstrap.mjs'].bytes.toString('base64');
    const application = await import(
      `data:text/javascript;base64,${source}#sha256=${parsed.runtime.bootstrapSha256}`
    );
    if (typeof application.runBootstrapCli !== 'function') fail();
    return await application.runBootstrapCli(argv, {
      bundleDir: args.bundleDir,
      digestBytes: Buffer.from(envelopeDigest.bytes),
      envelopeBytes: Buffer.from(envelope.bytes),
      files: Object.fromEntries(
        Object.entries(files).map(([name, row]) => [name, {
          bytes: Buffer.from(row.bytes),
          mode: row.mode,
          owner: row.owner,
          symlink: false,
        }])
      ),
      owner: args.owner,
    });
  } finally {
    for (const file of heldFiles.reverse()) closeSync(file.descriptor);
  }
}

if (process.argv[1] && same(lstatSync(resolve(process.argv[1])), lstatSync(fileURLToPath(import.meta.url)))) {
  try {
    await launchTask9Bootstrap(process.argv.slice(2));
  } catch {
    process.stderr.write('task9 bootstrap launcher refused\n');
    process.exitCode = 1;
  }
}
