import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { compareRunnerRuntimePaths } from './runner-runtime-receipt-contract.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const MANIFEST_PATH = '/srv/baci-cwv/receipts/runner-runtime-manifest.json';
const RECEIPT_PATH = `${MANIFEST_PATH}.sha256`;
const IMAGE_ID_PATH = '/srv/baci-cwv/image-id';
const IMAGE_ID_RECEIPT_PATH = `${IMAGE_ID_PATH}.sha256`;
const MAXIMUM_FILE_BYTES = 134_217_728;
const GENERATED = Object.freeze([
  Object.freeze({ maximumBytes: 65_536, path: '.credentials' }),
  Object.freeze({ maximumBytes: 65_536, path: '.credentials_rsaparams' }),
  Object.freeze({ maximumBytes: 16_384, path: '.runner' }),
]);
export const runnerRuntimeExecutables = Object.freeze([
  'bin/Runner.Listener',
  'bin/Runner.PluginHost',
  'bin/Runner.Worker',
  'externals/node24/bin/node',
]);
const REQUIRED = Object.freeze([...runnerRuntimeExecutables, 'entrypoint.mjs']);
const FORBIDDEN = new Set([
  '.env',
  '.path',
  '_diag',
  'bin/installdependencies.sh',
  'config.sh',
  'diagnostics',
  'env.sh',
  'run-helper.cmd.template',
  'run-helper.sh',
  'run-helper.sh.template',
  'run.sh',
  'safe_sleep.sh',
  'svc.sh',
]);
const fail = () => {
  throw new TypeError('runner runtime projection refused');
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const safePath = (value) => {
  if (
    typeof value !== 'string' ||
    !value ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  )
    fail();
  const first = value.split('/')[0];
  if (FORBIDDEN.has(value) || FORBIDDEN.has(first)) fail();
  return value;
};
export function parseRunnerRuntimeManifest(value, expectedImageId) {
  if (
    !exactKeys(value, [
      'files',
      'imageId',
      'receiptBinding',
      'schemaVersion',
    ]) ||
    value.schemaVersion !== 1 ||
    value.receiptBinding !== 'runner-runtime-closure-v1' ||
    !IMAGE.test(value.imageId ?? '') ||
    value.imageId !== expectedImageId ||
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    value.files.length > 10_000
  )
    fail();
  const files = value.files.map((entry) => {
    if (!exactKeys(entry, ['mode', 'path', 'sha256'])) fail();
    const path = safePath(entry.path);
    if (GENERATED.some((generated) => generated.path === path)) fail();
    const executable = runnerRuntimeExecutables.includes(path);
    if (
      entry.mode !== (executable ? '0555' : '0444') ||
      !SHA256.test(entry.sha256 ?? '')
    )
      fail();
    return Object.freeze({ ...entry, executable, generated: false });
  });
  const paths = files.map(({ path }) => path);
  if (
    new Set(paths).size !== paths.length ||
    paths.some(
      (path, index) =>
        index > 0 && compareRunnerRuntimePaths(paths[index - 1], path) >= 0
    ) ||
    REQUIRED.some((path) => !paths.includes(path))
  )
    fail();
  return Object.freeze({
    files: Object.freeze(files),
    imageId: value.imageId,
    receiptBinding: value.receiptBinding,
    schemaVersion: 1,
  });
}
async function readRootFile(path, mode, maximumBytes, owner) {
  const before = await lstat(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== owner.uid ||
    before.gid !== owner.gid ||
    before.nlink !== 1 ||
    (before.mode & 0o777) !== mode ||
    before.size > maximumBytes
  )
    fail();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino) fail();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mode !== opened.mode ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      after.nlink !== opened.nlink ||
      after.uid !== opened.uid ||
      after.gid !== opened.gid
    )
      fail();
    return bytes;
  } finally {
    await handle.close();
  }
}
export async function readRunnerImageId(options = {}) {
  const path = options.path ?? IMAGE_ID_PATH;
  const receiptPath = options.receiptPath ?? IMAGE_ID_RECEIPT_PATH;
  const owner = options.owner ?? { gid: 0, uid: 0 };
  const [bytes, receipt] = await Promise.all([
    readRootFile(path, 0o644, 90, owner),
    readRootFile(receiptPath, 0o644, 65, owner),
  ]);
  const authority = bytes.toString('utf8');
  if (
    !/^BACI_CWV_IMAGE_ID=sha256:[a-f0-9]{64}\n$/.test(authority) ||
    receipt.toString('utf8') !== `${sha256(bytes)}\n`
  )
    fail();
  return authority.slice('BACI_CWV_IMAGE_ID='.length, -1);
}
export async function readRunnerRuntimeManifest(expectedImageId, options = {}) {
  const path = options.path ?? MANIFEST_PATH;
  const receiptPath = options.receiptPath ?? RECEIPT_PATH;
  const owner = options.owner ?? { gid: 0, uid: 0 };
  const [bytes, receipt] = await Promise.all([
    readRootFile(path, 0o400, 16_777_216, owner),
    readRootFile(receiptPath, 0o400, 65, owner),
  ]);
  const receiptText = receipt.toString('utf8');
  if (receiptText !== `${sha256(bytes)}\n`) fail();
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail();
  }
  if (canonical(value) !== bytes.toString('utf8')) fail();
  return parseRunnerRuntimeManifest(value, expectedImageId);
}
const projectionFiles = (manifest) =>
  [
    ...manifest.files,
    ...GENERATED.map((entry) => ({
      ...entry,
      executable: false,
      generated: true,
      mode: '0600',
    })),
  ].sort((left, right) => left.path.localeCompare(right.path));

const projectionDirectories = (files) => {
  const paths = new Set(['']);
  for (const { path } of files) {
    let current = dirname(path);
    while (current !== '.') {
      paths.add(current);
      current = dirname(current);
    }
  }
  return [...paths].sort();
};

async function readProjectionFile(root, entry, identity, sealed) {
  const path = join(root, entry.path);
  const before = await lstat(path);
  const expectedMode = sealed
    ? entry.executable
      ? 0o550
      : 0o440
    : Number.parseInt(entry.mode, 8);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== identity.uid ||
    before.gid !== identity.gid ||
    before.nlink !== 1 ||
    (before.mode & 0o777) !== expectedMode ||
    before.size > (entry.maximumBytes ?? MAXIMUM_FILE_BYTES)
  )
    fail();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino) fail();
    const bytes = await handle.readFile();
    const digest = sha256(bytes);
    if (!entry.generated && digest !== entry.sha256) fail();
    return Object.freeze({ digest, entry, stat: before });
  } finally {
    await handle.close();
  }
}
export async function inspectRunnerProjection(
  root,
  manifest,
  identity,
  sealed = false
) {
  const files = projectionFiles(manifest);
  const directories = projectionDirectories(files);
  const expected = new Set([
    ...directories.filter(Boolean).map((path) => `${path}/`),
    ...files.map(({ path }) => path),
  ]);
  const actual = [];
  const walk = async (relative = '') => {
    for (const name of (await readdir(join(root, relative))).sort()) {
      const child = relative ? `${relative}/${name}` : name;
      const details = await lstat(join(root, child));
      if (details.isSymbolicLink()) fail();
      if (details.isDirectory()) {
        actual.push(`${child}/`);
        await walk(child);
      } else if (details.isFile()) actual.push(child);
      else fail();
    }
  };
  const rootDetails = await lstat(root);
  if (
    !rootDetails.isDirectory() ||
    rootDetails.isSymbolicLink() ||
    rootDetails.uid !== identity.uid ||
    rootDetails.gid !== identity.gid ||
    (sealed
      ? (rootDetails.mode & 0o777) !== 0o550
      : (rootDetails.mode & 0o022) !== 0)
  )
    fail();
  await walk();
  if (
    actual.length !== expected.size ||
    actual.some((path) => !expected.has(path))
  )
    fail();
  for (const relative of directories.filter(Boolean)) {
    const details = await lstat(join(root, relative));
    if (
      details.uid !== identity.uid ||
      details.gid !== identity.gid ||
      (sealed ? (details.mode & 0o777) !== 0o550 : (details.mode & 0o022) !== 0)
    )
      fail();
  }
  const records = [];
  for (const entry of files)
    records.push(await readProjectionFile(root, entry, identity, sealed));
  return Object.freeze({
    directories: Object.freeze(directories),
    files: Object.freeze(records),
  });
}
