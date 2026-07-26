import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { recordJournalEntry } from './campaign-state.mjs';
import {
  acceptTarget,
  beginPrepare,
  verifyCopiedInputs,
  verifySyntheticProof,
} from './install-prepare.mjs';
import {
  markWatchdogArmed,
  persistPrepareState,
  readPrepareState,
} from './install-prepare-store.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFs = { lstat, open, readdir };

function stableNode(expected, actual, type) {
  return (
    expected.dev === actual.dev &&
    expected.ino === actual.ino &&
    expected.uid === actual.uid &&
    expected.size === actual.size &&
    expected.mtimeNs === actual.mtimeNs &&
    expected.ctimeNs === actual.ctimeNs &&
    (expected.mode & 0o777n) === (actual.mode & 0o777n) &&
    (type === 'directory' ? actual.isDirectory() : actual.isFile())
  );
}

function requireStableNode(expected, actual, type) {
  if (!stableNode(expected, actual, type))
    throw new Error('owned prepare resource changed during snapshot');
}

async function readHeldFile(path, expected, filesystem) {
  const handle = await filesystem.open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    requireStableNode(expected, await handle.stat({ bigint: true }), 'file');
    const bytes = await handle.readFile();
    requireStableNode(expected, await handle.stat({ bigint: true }), 'file');
    requireStableNode(
      expected,
      await filesystem.lstat(path, { bigint: true }),
      'file'
    );
    return bytes;
  } finally {
    await handle.close();
  }
}

async function readStableFile(path, expected, filesystem) {
  const first = await readHeldFile(path, expected, filesystem);
  const second = await readHeldFile(path, expected, filesystem);
  if (!first.equals(second))
    throw new Error('owned prepare resource changed during snapshot');
  requireStableNode(
    expected,
    await filesystem.lstat(path, { bigint: true }),
    'file'
  );
  return first;
}

async function treeHash(root, expected, filesystem) {
  requireStableNode(
    expected,
    await filesystem.lstat(root, { bigint: true }),
    'directory'
  );
  const rows = [];
  for (const name of (await filesystem.readdir(root)).sort()) {
    const child = join(root, name);
    const details = await filesystem.lstat(child, { bigint: true });
    if (details.isSymbolicLink())
      throw new Error('owned prepare symlink refused');
    if (!details.isDirectory() && !details.isFile())
      throw new Error('unsafe owned prepare resource');
    const content = details.isDirectory()
      ? await treeHash(child, details, filesystem)
      : sha256(await readStableFile(child, details, filesystem));
    requireStableNode(
      details,
      await filesystem.lstat(child, { bigint: true }),
      details.isDirectory() ? 'directory' : 'file'
    );
    rows.push([name, Number(details.mode & 0o777n), content]);
  }
  requireStableNode(
    expected,
    await filesystem.lstat(root, { bigint: true }),
    'directory'
  );
  return sha256(JSON.stringify(rows));
}

export async function buildOwnedPrepareReceipt(
  root,
  relative,
  type,
  mutable = false,
  filesystem = sourceFs
) {
  if (
    !/^prepare-[a-z0-9][a-z0-9-]{0,52}$/.test(relative) ||
    !['file', 'tree'].includes(type) ||
    (mutable !== false && (mutable !== true || type !== 'tree'))
  )
    throw new TypeError('invalid owned prepare resource');
  const [rootDetails, details] = await Promise.all([
    filesystem.lstat(root, { bigint: true }),
    filesystem.lstat(join(root, relative), { bigint: true }),
  ]);
  if (
    !rootDetails.isDirectory() ||
    rootDetails.isSymbolicLink() ||
    details.isSymbolicLink() ||
    (type === 'tree' ? !details.isDirectory() : !details.isFile()) ||
    rootDetails.uid !== BigInt(process.getuid()) ||
    details.uid !== BigInt(process.getuid()) ||
    (rootDetails.mode & 0o077n) !== 0n ||
    (details.mode & 0o077n) !== 0n
  )
    throw new Error('unsafe owned prepare resource');
  const receipt = {
    schemaVersion: 1,
    root,
    rootDev: Number(rootDetails.dev),
    rootIno: Number(rootDetails.ino),
    relative,
    type,
    dev: Number(details.dev),
    ino: Number(details.ino),
    uid: Number(details.uid),
    mode: Number(details.mode & 0o777n),
    contentSha256:
      type === 'tree'
        ? await treeHash(join(root, relative), details, filesystem)
        : sha256(
            await readStableFile(join(root, relative), details, filesystem)
          ),
  };
  requireStableNode(
    rootDetails,
    await filesystem.lstat(root, { bigint: true }),
    'directory'
  );
  requireStableNode(
    details,
    await filesystem.lstat(join(root, relative), { bigint: true }),
    type === 'tree' ? 'directory' : 'file'
  );
  return mutable ? { ...receipt, mutable: true } : receipt;
}

export async function capturePrepare(directory, input) {
  const state = beginPrepare(input);
  await persistPrepareState(directory, state);
  return state;
}

export async function armPrepareWatchdog(directory, watchdogReceiptSha256) {
  const state = markWatchdogArmed(
    await readPrepareState(directory),
    watchdogReceiptSha256
  );
  await persistPrepareState(directory, state);
  return state;
}

export async function verifyPreparedCopies(directory, actual) {
  const state = verifyCopiedInputs(await readPrepareState(directory), actual);
  await persistPrepareState(directory, state);
  return state;
}

export async function proveSyntheticContainment(directory, proof) {
  const state = verifySyntheticProof(await readPrepareState(directory), proof);
  await persistPrepareState(directory, state);
  return state;
}

export async function acceptPreparedTarget(directory, proof) {
  const state = acceptTarget(await readPrepareState(directory), proof);
  await persistPrepareState(directory, state);
  return state;
}

export async function journalOwnedPrepare(
  campaignRoot,
  transactionId,
  action,
  receipt
) {
  return await recordJournalEntry({
    root: campaignRoot,
    transactionId,
    action,
    resource: receipt,
  });
}

async function input(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main(argv) {
  const [command, directory, value] = argv;
  let state;
  if (command === 'capture')
    state = await capturePrepare(directory, await input(value));
  else if (command === 'arm-watchdog')
    state = await armPrepareWatchdog(directory, value);
  else if (command === 'verify-copies')
    state = await verifyPreparedCopies(directory, await input(value));
  else if (command === 'prove-synthetic')
    state = await proveSyntheticContainment(directory, await input(value));
  else if (command === 'accept-target')
    state = await acceptPreparedTarget(directory, await input(value));
  else if (command === 'owned-receipt') {
    process.stdout.write(
      `${JSON.stringify(await buildOwnedPrepareReceipt(directory, value, argv[3], argv[4] === 'mutable'))}\n`
    );
    return;
  } else if (command === 'journal-owned') {
    await journalOwnedPrepare(directory, value, argv[3], await input(argv[4]));
    return;
  } else if (command === 'read') state = await readPrepareState(directory);
  else throw new Error('unsupported prepare controller command');
  process.stdout.write(`${JSON.stringify(state)}\n`);
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
