// biome-ignore assist/source/organizeImports: split fs imports keeps this bounded source file at its contract limit
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename } from 'node:fs/promises';
import { link, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { readRecoverableBootstrapJournal } from './install-bootstrap-journal.mjs';

export { persistBootstrapCapture } from './install-bootstrap-capture-persistence.mjs';
const HEX = /^[0-9a-f]{64}$/;
const SOURCE = /^[0-9a-f]{40}$/;
const TRANSACTION = /^bootstrap-[a-z0-9][a-z0-9-]{0,50}$/;
// biome-ignore format: bounded source file keeps this closed path allowlist on one line
const ALLOWED_PATH = /^(?:\/etc\/(?:baci-cwv\/[^/]+|systemd\/system\/(?:baci-cwv-[^/]+|cwv-measurement(?:-control)?\.slice))|\/srv\/baci-cwv\/(?:sealed\/[a-z0-9._-]+|hooks\/job-start-hook\.sh))$/;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
// biome-ignore format: bounded source file keeps this terminal helper compact
const fail = (message) => { throw new TypeError(message); };
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort());
const canonical = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('invalid canonical value');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
const metadata = (value, allowAbsent = false) => {
  if (allowAbsent && exactKeys(value, ['absent']) && value.absent === true)
    return { absent: true };
  if (!exactKeys(value, ['sha256', 'mode', 'owner']))
    fail('invalid file metadata');
  if (!HEX.test(value.sha256)) fail('invalid file digest');
  if (!/^(?:0400|0500|0550|0600|0640|0644)$/.test(value.mode))
    fail('invalid file mode');
  if (!/^(?:root:root|root:baci-cwv)$/.test(value.owner))
    fail('invalid file owner');
  return { sha256: value.sha256, mode: value.mode, owner: value.owner };
};
const projection = (value, allowAbsent = false) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('invalid file projection');
  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  if (!entries.length) fail('empty file projection');
  return Object.fromEntries(
    entries.map(([path, details]) => {
      if (!ALLOWED_PATH.test(path) || path.includes('..'))
        fail('unsafe install path');
      return [path, metadata(details, allowAbsent)];
    })
  );
};
export function beginBootstrap(input) {
  if (
    !exactKeys(input, [
      'transactionId',
      'sourceSha',
      'sourceManifestSha256',
      'policyFileSha256',
      'prior',
      'files',
    ])
  )
    fail('invalid bootstrap input');
  if (!TRANSACTION.test(input.transactionId)) fail('invalid transaction');
  if (!SOURCE.test(input.sourceSha)) fail('invalid source sha');
  if (!HEX.test(input.sourceManifestSha256)) fail('invalid manifest digest');
  if (!HEX.test(input.policyFileSha256)) fail('invalid policy digest');
  const files = projection(input.files);
  const prior = projection(input.prior, true);
  if (canonical(Object.keys(files)) !== canonical(Object.keys(prior)))
    fail('prior projection mismatch');
  const capture = {
    schemaVersion: 1,
    transactionId: input.transactionId,
    sourceSha: input.sourceSha,
    sourceManifestSha256: input.sourceManifestSha256,
    policyFileSha256: input.policyFileSha256,
    files,
    prior,
  };
  const captureBytes = canonical(capture);
  return {
    ...capture,
    phase: 'captured',
    journal: [],
    captureBytes,
    captureSha256: sha256(captureBytes),
  };
}
// biome-ignore format: bounded source file keeps the fixed state validator compact
const unitStates = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('live unit state required');
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) fail('live unit state required');
  for (const [unit, state] of entries) {
    if (!/^baci-cwv-[a-z-]+(?:@\.service|\.service|\.timer)$/.test(unit)) fail('invalid unit state');
    if (!/^loaded\ninactive\n(?:disabled|static)\n$/.test(state))
      fail('unit state is not disabled and inactive');
  }
  return Object.fromEntries(entries);
};
export function completeBootstrap(capture, actualFiles, liveUnitStates) {
  if (capture.phase !== 'captured' || !HEX.test(capture.captureSha256))
    fail('invalid bootstrap phase');
  const actual = projection(actualFiles);
  if (canonical(actual) !== canonical(capture.files))
    fail('installed projection mismatch');
  const disabledUnits = unitStates(liveUnitStates);
  const receipt = {
    schemaVersion: 1,
    captureSha256: capture.captureSha256,
    sourceSha: capture.sourceSha,
    sourceManifestSha256: capture.sourceManifestSha256,
    policyFileSha256: capture.policyFileSha256,
    files: actual,
    unitStates: disabledUnits,
  };
  const receiptBytes = canonical(receipt);
  return {
    ...capture,
    phase: 'complete',
    receipt,
    receiptBytes,
    receiptSha256: sha256(receiptBytes),
  };
}
export function recoveryPlan(capture) {
  if (capture.phase === 'complete') return { remove: [], restore: {} };
  if (capture.phase !== 'captured') fail('invalid recovery phase');
  const remove = [];
  const restore = {};
  for (const [path, prior] of Object.entries(capture.prior)) {
    if (prior.absent) remove.push(path);
    else restore[path] = prior;
  }
  return { remove: remove.sort(), restore };
}
async function privateDirectory(path, create = false) {
  if (create) await mkdir(path, { mode: 0o700 });
  const info = await lstat(path);
  // biome-ignore format: bounded source file keeps private directory contract compact
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o700) fail('private state directory required');
}
async function writeExclusive(path, bytes) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
// biome-ignore format: bounded source file keeps receipt crash recovery compact
async function receiptResidue(path, bytes, partial = false, links = 1) {
  let before;
  try { before = await lstat(path); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== process.getuid() || (before.mode & 0o777) !== 0o600 || before.nlink !== links || before.size > Buffer.byteLength(bytes)) fail('receipt residue mismatch');
  const actual = await readFile(path); const after = await lstat(path); const expected = Buffer.from(bytes);
  if (before.ino !== after.ino || before.ctimeMs !== after.ctimeMs) fail('receipt residue mismatch');
  return actual.equals(expected) ? 'exact' : partial && expected.subarray(0, actual.length).equals(actual) ? 'partial' : fail('receipt residue mismatch');
}
// biome-ignore format: bounded source file keeps receipt crash recovery compact
async function writeExactReceipt(directory, name, bytes) {
  const temporaryName = `.${name}.tmp.${sha256(bytes)}`; const destination = join(directory, name); const temporary = join(directory, temporaryName);
  const entries = await readdir(directory);
  for (const entry of entries) if (entry.startsWith(`.${name}.tmp.`) && entry !== temporaryName) fail('receipt residue mismatch');
  if (entries.includes(name) && entries.includes(temporaryName)) {
    await receiptResidue(destination, bytes, false, 2); await receiptResidue(temporary, bytes, false, 2);
    const [left, right] = await Promise.all([lstat(destination), lstat(temporary)]);
    if (left.dev !== right.dev || left.ino !== right.ino || left.nlink !== 2 || right.nlink !== 2) fail('receipt residue mismatch');
    await unlink(temporary); await fsyncDirectory(directory); return;
  }
  const existing = await receiptResidue(destination, bytes); const residue = await receiptResidue(temporary, bytes, true);
  if (existing) { if (residue) { await unlink(temporary); await fsyncDirectory(directory); } return; }
  if (residue) { await unlink(temporary); await fsyncDirectory(directory); }
  await writeExclusive(temporary, bytes);
  try { await link(temporary, destination); } catch (error) { if (error?.code !== 'EEXIST' || !(await receiptResidue(destination, bytes))) throw error; }
  await unlink(temporary); await fsyncDirectory(directory);
}
async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function atomicPhase(directory, phase) {
  if (phase === 'complete') {
    let pruned = false;
    for (const entry of await readdir(directory)) {
      if (!entry.startsWith('.phase-')) continue;
      // biome-ignore format: bounded source file keeps completion phase authentication compact
      if (!/^\.phase-[1-9][0-9]*$/.test(entry)) fail('receipt residue mismatch');
      await receiptResidue(join(directory, entry), 'complete\n', true);
      await unlink(join(directory, entry));
      pruned = true;
    }
    if (pruned) await fsyncDirectory(directory);
  }
  const temporary = join(directory, `.phase-${process.pid}`);
  await writeExclusive(temporary, `${phase}\n`);
  await rename(temporary, join(directory, 'phase'));
  await fsyncDirectory(directory);
}
export async function appendBootstrapJournal(directory, event) {
  const state = await readBootstrapState(directory);
  if (state.phase !== 'captured') fail('bootstrap journal is closed');
  if (
    !exactKeys(event, ['action', 'path', 'sha256']) ||
    !['install-file', 'render-watchdog', 'disable-unit'].includes(
      event.action
    ) ||
    !ALLOWED_PATH.test(event.path) ||
    !HEX.test(event.sha256)
  )
    fail('invalid bootstrap journal event');
  const previous = state.journal.at(-1)?.sha256 ?? state.captureSha256;
  const row = {
    sequence: state.journal.length + 1,
    previousSha256: previous,
    action: event.action,
    path: event.path,
    fileSha256: event.sha256,
  };
  const rowBytes = canonical(row);
  const output = `${rowBytes.slice(0, -1)},"sha256":${JSON.stringify(sha256(rowBytes))}}`;
  const handle = await open(join(directory, 'journal.ndjson'), 'a', 0o600);
  try {
    await handle.write(`${output}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return JSON.parse(output);
}
export async function persistBootstrapReceipt(directory, complete) {
  const current = await readBootstrapState(directory);
  if (current.phase !== 'captured' || complete.phase !== 'complete')
    fail('invalid bootstrap completion');
  if (complete.captureSha256 !== current.captureSha256)
    fail('capture digest mismatch');
  await writeExactReceipt(directory, 'receipt.json', complete.receiptBytes);
  await writeExactReceipt(
    directory,
    'receipt.sha256',
    `${complete.receiptSha256}\n`
  );
  await atomicPhase(directory, 'complete');
}
export async function readBootstrapState(directory) {
  await privateDirectory(directory);
  const captureBytes = await readFile(join(directory, 'capture.json'), 'utf8');
  // biome-ignore format: bounded source file keeps this validated read compact
  const captureSha256 = (await readFile(join(directory, 'capture.sha256'), 'utf8')).trim();
  if (!HEX.test(captureSha256) || sha256(captureBytes) !== captureSha256)
    fail('capture digest mismatch');
  const capture = JSON.parse(captureBytes);
  const journalSource = await readRecoverableBootstrapJournal(
    join(directory, 'journal.ndjson')
  );
  const journal = journalSource
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  let previous = captureSha256;
  for (const [index, row] of journal.entries()) {
    const { sha256: rowSha256, ...body } = row;
    // biome-ignore format: bounded source file keeps journal binding compact
    if (row.sequence !== index + 1 || row.previousSha256 !== previous || !HEX.test(rowSha256) || sha256(canonical(body)) !== rowSha256) fail('journal chain mismatch');
    previous = rowSha256;
  }
  const phase = (await readFile(join(directory, 'phase'), 'utf8')).trim();
  if (phase !== 'captured' && phase !== 'complete')
    fail('invalid durable phase');
  if (phase === 'complete') {
    // biome-ignore format: bounded source file keeps receipt read compact
    const receiptBytes = await readFile(join(directory, 'receipt.json'), 'utf8');
    // biome-ignore format: bounded source file keeps this validated read compact
    const receiptSha256 = (await readFile(join(directory, 'receipt.sha256'), 'utf8')).trim();
    if (!HEX.test(receiptSha256) || sha256(receiptBytes) !== receiptSha256)
      fail('receipt digest mismatch');
    const receipt = JSON.parse(receiptBytes);
    // biome-ignore format: fixed receipt binding is deliberately compact
    if (canonical(receipt) !== receiptBytes || receipt.captureSha256 !== captureSha256 || receipt.sourceSha !== capture.sourceSha || receipt.sourceManifestSha256 !== capture.sourceManifestSha256 || receipt.policyFileSha256 !== capture.policyFileSha256 || canonical(unitStates(receipt.unitStates)) !== canonical(receipt.unitStates) || canonical(receipt.files) !== canonical(capture.files)) fail('receipt binding mismatch');
    // biome-ignore format: bounded source file keeps receipt return compact
    return { ...capture, captureSha256, phase, journal, receipt, receiptSha256 };
  }
  return { ...capture, captureSha256, phase, journal };
}
