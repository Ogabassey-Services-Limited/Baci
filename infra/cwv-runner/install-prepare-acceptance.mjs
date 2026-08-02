import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { validateImageProcessMap } from './image-process-map.mjs';
import { readPreparedRuntimeReceipt } from './install-prepare-runtime-receipt.mjs';
import { readPrepareState } from './install-prepare-store.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { publishRunnerRuntimeProjection } from './runner-runtime-identity-manifest.mjs';

const IMAGE = /^sha256:[a-f0-9]{64}$/;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const PROCESS_MAP_POLICY = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
);
const canonical = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object')
    throw new TypeError('invalid canonical value');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};

function processMapBytes(value) {
  try {
    validateImageProcessMap(value, PROCESS_MAP_POLICY);
  } catch (cause) {
    throw new TypeError('invalid image process map receipt', { cause });
  }
  return Buffer.from(canonical(value));
}

async function syncDirectory(directory) {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertDirectory(directory, owner, group) {
  const details = await lstat(directory);
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.uid !== owner ||
    details.gid !== group ||
    (details.mode & 0o022) !== 0
  )
    throw new Error('safe acceptance root required');
}

async function assertReceiptDirectory(root, owner, group, name = 'receipts') {
  const directory = join(root, name);
  try {
    await lstat(directory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try {
      await mkdir(directory, { mode: 0o700 });
      await (await open(directory, 'r')).close();
    } catch (createError) {
      if (createError.code !== 'EEXIST') throw createError;
    }
  }
  const details = await lstat(directory);
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.uid !== owner ||
    details.gid !== group ||
    (details.mode & 0o777) !== 0o700
  )
    throw new Error('safe acceptance receipts directory required');
  return directory;
}

async function writeBound(
  directory,
  name,
  bytes,
  mode,
  owner,
  group,
  transaction
) {
  const destination = join(directory, name);
  try {
    const details = await lstat(destination);
    if (
      !details.isFile() ||
      details.isSymbolicLink() ||
      details.uid !== owner ||
      details.gid !== group ||
      (details.mode & 0o777) !== mode ||
      !(await readFile(destination)).equals(bytes)
    )
      throw new Error('accepted receipt drift');
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = join(
    directory,
    transaction
      ? `.${name}-${transaction}-${process.pid}`
      : `.${name}-${process.pid}`
  );
  const handle = await open(temporary, 'wx', mode);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.chown(owner, group);
    await handle.chmod(mode);
  } finally {
    await handle.close();
  }
  await rename(temporary, destination);
  await syncDirectory(directory);
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function recoverRuntimeTemps(
  directory,
  names,
  transaction,
  owner,
  group
) {
  const pattern = new RegExp(
    `^\\.(${names.map(escapeRegex).join('|')})-${escapeRegex(transaction)}-[0-9]+$`
  );
  let changed = false;
  for (const name of await readdir(directory)) {
    if (!pattern.test(name)) continue;
    const details = await lstat(join(directory, name));
    if (
      !details.isFile() ||
      details.isSymbolicLink() ||
      details.uid !== owner ||
      details.gid !== group ||
      details.nlink !== 1 ||
      ![0o400, 0o600].includes(details.mode & 0o777)
    )
      throw new Error('unsafe interrupted runtime receipt');
    await unlink(join(directory, name));
    changed = true;
  }
  if (changed) await syncDirectory(directory);
}
async function assertRuntimeReceiptNames(directory, names) {
  if ((await readdir(directory)).some((name) => !names.includes(name)))
    throw new Error('unsafe runtime receipt directory');
}

export async function publishAcceptedPrepare(
  stateDirectory,
  root,
  owner = process.getuid(),
  group = process.getgid()
) {
  await assertDirectory(root, owner, group);
  const state = await readPrepareState(stateDirectory);
  if (state.phase !== 'target-accepted' || !IMAGE.test(state.imageId))
    throw new Error('accepted target state required');
  const receiptPath = join(stateDirectory, 'build-receipt.json');
  const details = await lstat(receiptPath);
  const receiptBytes = await readFile(receiptPath);
  if (
    !details.isFile() ||
    details.isSymbolicLink() ||
    details.uid !== owner ||
    details.gid !== group ||
    (details.mode & 0o777) !== 0o600 ||
    sha256(receiptBytes) !== state.expected.receiptSha256
  )
    throw new Error('durable build receipt mismatch');
  let receipt;
  try {
    receipt = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(receiptBytes)
    );
  } catch {
    throw new Error('malformed accepted build receipt');
  }
  if (canonical(receipt) !== receiptBytes.toString('utf8'))
    throw new Error('noncanonical accepted build receipt');
  if (
    receipt.imageId !== state.imageId ||
    receipt.configDigest !== state.imageConfigDigest
  )
    throw new Error('accepted image receipt mismatch');
  const mapBytes = processMapBytes(receipt.processMap);
  const runtime = await readPreparedRuntimeReceipt(
    stateDirectory,
    receiptBytes,
    state.imageId,
    { gid: group, uid: owner }
  );
  const receipts = await assertReceiptDirectory(root, owner, group);
  const runtimeReceipts = await assertReceiptDirectory(
    receipts,
    owner,
    group,
    'runner-runtime'
  );
  const imageBytes = Buffer.from(`BACI_CWV_IMAGE_ID=${state.imageId}\n`);
  const files = [
    ['image-id', imageBytes, 0o644],
    ['image-id.sha256', Buffer.from(`${sha256(imageBytes)}\n`), 0o644],
    ['image-receipt.json', receiptBytes, 0o600],
    ['image-receipt.sha256', Buffer.from(`${sha256(receiptBytes)}\n`), 0o600],
  ];
  for (const [name, bytes, mode] of files)
    await writeBound(root, name, bytes, mode, owner, group);
  await writeBound(
    receipts,
    'image-process-map.json',
    mapBytes,
    0o400,
    owner,
    group
  );
  await writeBound(
    receipts,
    'image-process-map.sha256',
    Buffer.from(`${sha256(mapBytes)}\n`),
    0o400,
    owner,
    group
  );
  await recoverRuntimeTemps(
    runtimeReceipts,
    runtime.files.map(({ name }) => name),
    state.transactionId,
    owner,
    group
  );
  await assertRuntimeReceiptNames(
    runtimeReceipts,
    runtime.files.map(({ name }) => name)
  );
  for (const { bytes, name } of runtime.files)
    await writeBound(
      runtimeReceipts,
      name,
      bytes,
      0o400,
      owner,
      group,
      state.transactionId
    );
  await publishRunnerRuntimeProjection(
    runtime.projectionDirectory,
    join(root, 'sealed/runtime-runner-binaries'),
    runtime.projection,
    { gid: group, uid: owner }
  );
  const value = {
    imageConfigDigest: state.imageConfigDigest,
    imageId: state.imageId,
    imageReceiptSha256: state.expected.receiptSha256,
    processMapSha256: sha256(mapBytes),
    runtimeContextSha256: runtime.contextSha256,
    runtimeIdentitySha256: runtime.imageEvidence.runtimeIdentitySha256,
    runtimeManifestSha256: runtime.manifestSha256,
    runtimeProjectionManifestSha256:
      runtime.imageEvidence.runtimeManifestSha256,
    schemaVersion: 1,
    transactionId: state.transactionId,
  };
  return { ...value, sha256: sha256(JSON.stringify(value)) };
}

if (import.meta.filename === process.argv[1]) {
  const [command, stateDirectory, root] = process.argv.slice(2);
  if (command !== 'publish') throw new Error('unsupported acceptance command');
  publishAcceptedPrepare(stateDirectory, root)
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
