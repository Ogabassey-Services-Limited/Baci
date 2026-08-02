import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { syncRegistrationAuthorityParent } from './registration-authority-parent-sync.mjs';

const ROOT = '/srv/baci-cwv/receipts';
const NAME = 'registration-terminal-receipt.json';
const IDENTITY = '/srv/baci-cwv/sealed/runner-identity.json';
const SHA256 = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
// biome-ignore format: fixed terminal receipt contract stays compact under the cap.
const RECEIPT_KEYS = ['captureSha256', 'cleanupSha256', 'imageDigest', 'registrationReleaseSha256', 'runnerIdentitySha256', 'schemaVersion', 'sealedRunnerSha256'];
// biome-ignore format: fixed terminal digest fields stay compact under the cap.
const RECEIPT_HASH_KEYS = ['captureSha256', 'cleanupSha256', 'registrationReleaseSha256', 'runnerIdentitySha256', 'sealedRunnerSha256'];
// biome-ignore format: closed refusal helper stays compact under the cap.
const fail = () => { throw new TypeError('registration terminal receipt refused'); };
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const syncParent = async (path, dependencies, owner) => {
  try {
    await syncRegistrationAuthorityParent(path, dependencies, owner);
  } catch {
    fail();
  }
};
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const root = () => {
  if (process.getuid?.() !== 0) fail();
};
const directory = (details, owner) =>
  details?.isDirectory?.() &&
  !details.isSymbolicLink?.() &&
  details.uid === owner.uid &&
  details.gid === owner.gid &&
  (details.mode & 0o777) === 0o700;
const file = (details, owner, maximum) =>
  details?.isFile?.() &&
  !details.isSymbolicLink?.() &&
  details.uid === owner.uid &&
  details.gid === owner.gid &&
  details.nlink === 1 &&
  (details.mode & 0o777) === 0o400 &&
  details.size > 1 &&
  details.size <= maximum;
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mode === right.mode &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.nlink === right.nlink;
function terminal(value) {
  if (
    !exact(value, RECEIPT_KEYS) ||
    value.schemaVersion !== 1 ||
    !IMAGE.test(value.imageDigest) ||
    !RECEIPT_HASH_KEYS.every((key) => SHA256.test(value[key]))
  )
    fail();
  return Object.freeze({ ...value });
}
function envelope(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > 2_048)
    fail();
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (
    !exact(value, ['receipt', 'sha256']) ||
    !SHA256.test(value.sha256) ||
    canonicalJson(value) !== bytes.toString('utf8')
  )
    fail();
  const receipt = terminal(value.receipt);
  if (value.sha256 !== digest(Buffer.from(canonicalJson(receipt)))) fail();
  return Object.freeze({ receipt, sha256: value.sha256 });
}
function paths(dependencies) {
  const rootPath = dependencies.receiptRoot ?? ROOT;
  return {
    identity: dependencies.identityPath ?? IDENTITY,
    receipt: join(rootPath, NAME),
    root: rootPath,
  };
}
function owners(dependencies) {
  const receipt = dependencies.receiptOwner ?? { gid: 0, uid: 0 };
  const identity = dependencies.identityOwner ?? { gid: 10001, uid: 0 };
  if (
    !Number.isInteger(receipt.uid) ||
    !Number.isInteger(receipt.gid) ||
    !Number.isInteger(identity.uid) ||
    !Number.isInteger(identity.gid)
  )
    fail();
  return { identity, receipt };
}
async function readOwned(path, owner, maximum, dependencies) {
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const before = await stat(path);
  if (!file(before, owner, maximum)) fail();
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (!file(opened, owner, maximum) || !same(before, opened)) fail();
    const bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      // biome-ignore format: fixed bounded-read arguments stay compact under the cap.
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!Number.isInteger(result?.bytesRead) || result.bytesRead <= 0) fail();
      offset += result.bytesRead;
    }
    const growth = await handle.read(Buffer.alloc(1), 0, 1, opened.size);
    if (growth?.bytesRead !== 0) fail();
    if (!same(opened, await handle.stat())) fail();
    return bytes;
  } finally {
    await handle.close();
  }
}
export async function readRegistrationTerminalReceipt(dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  if (typeof assertRoot !== 'function') fail();
  assertRoot();
  const owner = owners(dependencies).receipt;
  const route = paths(dependencies);
  const stat = dependencies.lstat ?? lstat;
  if (!directory(await stat(route.root), owner)) fail();
  try {
    return envelope(await readOwned(route.receipt, owner, 2_048, dependencies));
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error instanceof TypeError
      ? error
      : new TypeError('registration terminal receipt refused');
  }
}
export async function readSealedRunnerIdentity(dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  if (typeof assertRoot !== 'function') fail();
  assertRoot();
  const value = owners(dependencies).identity;
  const route = paths(dependencies);
  try {
    const bytes = await readOwned(route.identity, value, 512, dependencies);
    let identity;
    try {
      identity = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail();
    }
    if (
      !exact(identity, ['generation', 'id', 'name']) ||
      identity.generation !== 1 ||
      !Number.isSafeInteger(identity.id) ||
      identity.id <= 0 ||
      typeof identity.name !== 'string' ||
      !identity.name ||
      canonicalJson(identity) !== bytes.toString('utf8')
    )
      fail();
    return Object.freeze({
      identity: Object.freeze(identity),
      sha256: digest(bytes),
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error instanceof TypeError
      ? error
      : new TypeError('registration terminal receipt refused');
  }
}
export function registrationTerminalState(receipt, identity) {
  if (receipt === undefined && identity === undefined)
    return Object.freeze({
      captureSha256: null,
      cleanupSha256: null,
      registrationComplete: false,
      imageDigest: null,
      registrationReleaseSha256: null,
      runnerIdentitySha256: null,
    });
  if (
    receipt === undefined ||
    identity === undefined ||
    receipt.receipt.runnerIdentitySha256 !== identity.sha256
  )
    fail();
  return Object.freeze({
    captureSha256: receipt.receipt.captureSha256,
    cleanupSha256: receipt.receipt.cleanupSha256,
    registrationComplete: true,
    imageDigest: receipt.receipt.imageDigest,
    registrationReleaseSha256: receipt.receipt.registrationReleaseSha256,
    runnerIdentitySha256: identity.sha256,
  });
}
export function serviceRegistrationState(complete, runnerIdentitySha256) {
  if (
    (complete !== false && complete !== true) ||
    (complete
      ? !SHA256.test(runnerIdentitySha256)
      : runnerIdentitySha256 !== null)
  )
    fail();
  return Object.freeze({
    registrationComplete: complete,
    runnerIdentitySha256,
  });
}
export async function readRegistrationTerminalState(dependencies = {}) {
  const [receipt, identity] = await Promise.all([
    readRegistrationTerminalReceipt(dependencies),
    readSealedRunnerIdentity(dependencies),
  ]);
  return registrationTerminalState(receipt, identity);
}
export async function publishRegistrationTerminalReceipt(
  receipt,
  dependencies = {}
) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const makeDirectory = dependencies.mkdir ?? mkdir;
  const openFile = dependencies.open ?? open;
  const move = dependencies.rename ?? rename;
  const removeFile = dependencies.unlink ?? unlink;
  const entropy = dependencies.randomBytes ?? randomBytes;
  if (typeof assertRoot !== 'function' || typeof entropy !== 'function') fail();
  assertRoot();
  const checked = terminal(receipt);
  const receiptBytes = Buffer.from(canonicalJson(checked));
  const expected = Object.freeze({
    receipt: checked,
    sha256: digest(receiptBytes),
  });
  const bytes = Buffer.from(canonicalJson(expected));
  const owner = owners(dependencies).receipt;
  const route = paths(dependencies);
  await makeDirectory(route.root, { mode: 0o700, recursive: true });
  if (!directory(await stat(route.root), owner)) fail();
  const current = await readRegistrationTerminalReceipt(dependencies);
  if (current !== undefined) {
    if (canonicalJson(current) !== canonicalJson(expected)) fail();
    await syncParent(route.root, dependencies, owner);
    return current;
  }
  const nonce = entropy(16);
  if (!Buffer.isBuffer(nonce) || nonce.length !== 16) fail();
  const temporary = join(route.root, `.${NAME}-${nonce.toString('hex')}`);
  let handle;
  try {
    handle = await openFile(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o400
    );
    await handle.writeFile(bytes);
    await handle.chown(owner.uid, owner.gid);
    await handle.chmod(0o400);
    await handle.sync();
    if (!file(await handle.stat(), owner, 2_048)) fail();
    await handle.close();
    await move(temporary, route.receipt);
    await syncParent(route.root, dependencies, owner);
    const published = await readRegistrationTerminalReceipt(dependencies);
    if (
      published === undefined ||
      canonicalJson(published) !== canonicalJson(expected)
    )
      fail();
    return published;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (handle)
      await Promise.resolve(temporary)
        .then(removeFile)
        .catch(() => undefined);
    throw error instanceof TypeError
      ? error
      : new TypeError('registration terminal receipt refused');
  }
}
