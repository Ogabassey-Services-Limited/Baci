import { createHash } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const HEX = /^[0-9a-f]{64}$/;
const PHASES = [
  'captured',
  'watchdog-armed',
  'copies-verified',
  'synthetic-proven',
  'target-accepted',
];
const BASE_FIELDS = [
  'schemaVersion',
  'transactionId',
  'external',
  'expected',
  'sourceManifestSha256',
  'policyFileSha256',
];
const INTRODUCED_FIELDS = {
  captured: [],
  'watchdog-armed': ['watchdogReceiptSha256'],
  'copies-verified': ['imageId', 'imageConfigDigest'],
  'synthetic-proven': [],
  'target-accepted': ['supervisorReceiptSha256'],
};
const fail = (message) => {
  throw new TypeError(message);
};
const canonical = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('invalid prepare state');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function privateDirectory(path) {
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    info.uid !== process.getuid() ||
    (info.mode & 0o077) !== 0
  )
    fail('private prepare directory required');
}
async function writeAtomic(directory, name, value) {
  const temporary = join(directory, `.${name}-${process.pid}`);
  let handle;
  let created = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    created = true;
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, join(directory, name));
    const parent = await open(directory, 'r');
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
function persistedFields(state) {
  const { phase: _, stateSha256: __, ...fields } = state;
  return fields;
}
function phaseFields(phase) {
  return [
    ...BASE_FIELDS,
    ...PHASES.slice(0, PHASES.indexOf(phase) + 1).flatMap(
      (item) => INTRODUCED_FIELDS[item]
    ),
  ].sort();
}

export function markWatchdogArmed(state, watchdogReceiptSha256) {
  if (state.phase !== 'captured' || !HEX.test(watchdogReceiptSha256))
    fail('valid watchdog receipt required');
  return { ...state, phase: 'watchdog-armed', watchdogReceiptSha256 };
}

export async function persistPrepareState(directory, state) {
  await privateDirectory(directory);
  if (!PHASES.includes(state.phase)) fail('invalid prepare phase');
  let current;
  try {
    current = await readPrepareState(directory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const fields = persistedFields(state);
  if (current) {
    const expected = PHASES[PHASES.indexOf(current.phase) + 1];
    if (state.phase !== expected) fail('invalid prepare transition');
    if (
      canonical(Object.keys(fields).sort()) !==
      canonical(phaseFields(state.phase))
    )
      fail('invalid prepare state fields');
    const currentFields = persistedFields(current);
    const preserved = Object.fromEntries(
      Object.keys(currentFields).map((key) => [key, fields[key]])
    );
    if (canonical(preserved) !== canonical(currentFields))
      fail('prepare authority drift');
  } else {
    if (state.phase !== 'captured') fail('invalid prepare transition');
    if (
      canonical(Object.keys(fields).sort()) !==
      canonical(phaseFields(state.phase))
    )
      fail('invalid prepare state fields');
  }
  const { stateSha256: _, ...unsigned } = state;
  const bytes = canonical({
    ...unsigned,
    stateSha256: sha256(canonical(unsigned)),
  });
  await writeAtomic(directory, 'prepare-state.json', bytes);
  await unlink(join(directory, 'prepare-state.sha256')).catch(() => undefined);
}

export async function readPrepareState(directory) {
  await privateDirectory(directory);
  const bytes = await readFile(join(directory, 'prepare-state.json'), 'utf8');
  const state = JSON.parse(bytes);
  if (canonical(state) !== bytes || !PHASES.includes(state.phase))
    fail('invalid durable prepare state');
  const { stateSha256, ...unsigned } = state;
  if (stateSha256 !== undefined) {
    if (!HEX.test(stateSha256) || sha256(canonical(unsigned)) !== stateSha256)
      fail('prepare state digest mismatch');
  } else {
    const digest = (
      await readFile(join(directory, 'prepare-state.sha256'), 'utf8')
    ).trim();
    if (!HEX.test(digest) || sha256(bytes) !== digest)
      fail('prepare state digest mismatch');
    // Existing installs used a sibling receipt; expose it through the new reader contract.
    return { ...state, stateSha256: digest };
  }
  return state;
}
