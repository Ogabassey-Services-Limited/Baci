import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

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
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    info.uid !== process.getuid() ||
    (info.mode & 0o777) !== 0o700
  )
    fail('private state directory required');
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
async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function atomicPhase(directory, phase) {
  const temporary = join(directory, `.phase-${process.pid}`);
  await writeExclusive(temporary, `${phase}\n`);
  await rename(temporary, join(directory, 'phase'));
  await fsyncDirectory(directory);
}
export async function persistBootstrapCapture(stateRoot, capture) {
  await privateDirectory(stateRoot);
  if (capture.phase !== 'captured') fail('captured bootstrap state required');
  const directory = join(stateRoot, capture.transactionId);
  await privateDirectory(directory, true);
  await fsyncDirectory(stateRoot);
  await writeExclusive(join(directory, 'capture.json'), capture.captureBytes);
  // biome-ignore format: bounded source file keeps this durable receipt write compact
  await writeExclusive(join(directory, 'capture.sha256'), `${capture.captureSha256}\n`);
  await writeExclusive(join(directory, 'journal.ndjson'), '');
  await atomicPhase(directory, 'captured');
  return directory;
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
  await writeExclusive(join(directory, 'receipt.json'), complete.receiptBytes);
  await writeExclusive(
    join(directory, 'receipt.sha256'),
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
  const journalSource = await readFile(
    join(directory, 'journal.ndjson'),
    'utf8'
  );
  const journal = journalSource
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  let previous = captureSha256;
  for (const [index, row] of journal.entries()) {
    const { sha256: rowSha256, ...body } = row;
    if (
      row.sequence !== index + 1 ||
      row.previousSha256 !== previous ||
      !HEX.test(rowSha256) ||
      sha256(canonical(body)) !== rowSha256
    )
      fail('journal chain mismatch');
    previous = rowSha256;
  }
  const phase = (await readFile(join(directory, 'phase'), 'utf8')).trim();
  if (phase !== 'captured' && phase !== 'complete')
    fail('invalid durable phase');
  if (phase === 'complete') {
    const receiptBytes = await readFile(
      join(directory, 'receipt.json'),
      'utf8'
    );
    // biome-ignore format: bounded source file keeps this validated read compact
    const receiptSha256 = (await readFile(join(directory, 'receipt.sha256'), 'utf8')).trim();
    if (!HEX.test(receiptSha256) || sha256(receiptBytes) !== receiptSha256)
      fail('receipt digest mismatch');
    const receipt = JSON.parse(receiptBytes);
    // biome-ignore format: fixed receipt binding is deliberately compact
    if (
      canonical(receipt) !== receiptBytes ||
      receipt.captureSha256 !== captureSha256 ||
      receipt.sourceSha !== capture.sourceSha ||
      receipt.sourceManifestSha256 !== capture.sourceManifestSha256 ||
      receipt.policyFileSha256 !== capture.policyFileSha256 ||
      canonical(unitStates(receipt.unitStates)) !== canonical(receipt.unitStates) ||
      canonical(receipt.files) !== canonical(capture.files)
    )
      fail('receipt binding mismatch');
    return {
      ...capture,
      captureSha256,
      phase,
      journal,
      receipt,
      receiptSha256,
    };
  }
  return { ...capture, captureSha256, phase, journal };
}
