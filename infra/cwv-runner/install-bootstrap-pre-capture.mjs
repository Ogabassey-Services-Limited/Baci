import {
  lstat,
  open,
  readdir,
  readFile,
  rmdir,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { beginBootstrap } from './install-bootstrap.mjs';

const PHASE_TEMPORARY = /^\.phase-[1-9][0-9]*$/;
const CAPTURE_KEYS = [
  'schemaVersion',
  'transactionId',
  'sourceSha',
  'sourceManifestSha256',
  'policyFileSha256',
  'files',
  'prior',
];
const sameKeys = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) ===
    canonicalJson([...CAPTURE_KEYS].sort());
const privateDetails = (details, directory = false) =>
  details.uid === process.getuid() &&
  details.gid === process.getgid() &&
  (details.mode & 0o777) === (directory ? 0o700 : 0o600) &&
  (directory ? details.isDirectory() : details.isFile()) &&
  !details.isSymbolicLink();
const refuse = () => {
  throw new TypeError('invalid pre-capture bootstrap transaction');
};

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function validateCapture(
  directory,
  entries,
  readStateFile,
  expectedCapture
) {
  if (!entries.includes('capture.json')) return;
  const bytes = await readStateFile(join(directory, 'capture.json'), 'utf8');
  let stored;
  try {
    stored = JSON.parse(bytes);
  } catch {
    refuse();
  }
  if (!sameKeys(stored) || stored.schemaVersion !== 1) refuse();
  const capture = beginBootstrap({
    transactionId: stored.transactionId,
    sourceSha: stored.sourceSha,
    sourceManifestSha256: stored.sourceManifestSha256,
    policyFileSha256: stored.policyFileSha256,
    files: stored.files,
    prior: stored.prior,
  });
  if (
    stored.transactionId !== basename(directory) ||
    stored.transactionId !== `bootstrap-${stored.sourceSha.slice(0, 12)}` ||
    bytes !== capture.captureBytes ||
    (expectedCapture && bytes !== expectedCapture.captureBytes)
  )
    refuse();
  for (const name of ['capture.sha256', '.capture-sha256-stage'])
    if (
      entries.includes(name) &&
      !`${capture.captureSha256}\n`.startsWith(
        await readStateFile(join(directory, name), 'utf8')
      )
    )
      refuse();
}

export async function reconcileBootstrapPreCapture(directory, descriptor = {}) {
  const readDirectory = descriptor.readDirectory ?? readdir;
  const readDetails = descriptor.readDetails ?? lstat;
  const readStateFile = descriptor.readStateFile ?? readFile;
  const removeFile = descriptor.removePreCaptureFile ?? unlink;
  const removeDirectory = descriptor.removePreCaptureDirectory ?? rmdir;
  const syncParent = descriptor.syncPreCaptureDirectory ?? syncDirectory;
  const transaction = /^bootstrap-([0-9a-f]{12})$/.exec(basename(directory));
  const directoryDetails = await readDetails(directory);
  if (!transaction || !privateDetails(directoryDetails, true)) refuse();
  const initial = await readDirectory(directory);
  const marker = '.pre-capture-cleanup';
  const cleaning = initial.includes(marker);
  const phaseTemporaries = initial.filter((name) => PHASE_TEMPORARY.test(name));
  const allowed = new Set([
    marker,
    '.capture-json-stage',
    '.capture-sha256-stage',
    'capture.json',
    'capture.sha256',
    'journal.ndjson',
    ...phaseTemporaries,
  ]);
  if (
    phaseTemporaries.length > 1 ||
    initial.some((name) => !allowed.has(name)) ||
    (!cleaning &&
      (((initial.includes('capture.sha256') ||
        initial.includes('.capture-sha256-stage')) &&
        !initial.includes('capture.json')) ||
        (initial.includes('capture.sha256') &&
          initial.includes('.capture-sha256-stage')) ||
        (initial.includes('journal.ndjson') &&
          !initial.includes('capture.sha256')) ||
        (phaseTemporaries.length === 1 && !initial.includes('journal.ndjson'))))
  )
    refuse();
  for (const name of initial)
    if (!privateDetails(await readDetails(join(directory, name)))) refuse();
  if (cleaning) {
    const details = await readDetails(join(directory, marker));
    if (details.size !== 0) refuse();
  } else {
    await validateCapture(
      directory,
      initial,
      readStateFile,
      descriptor.expectedCapture
    );
    if (
      initial.includes('journal.ndjson') &&
      (await readStateFile(join(directory, 'journal.ndjson'), 'utf8')) !== ''
    )
      refuse();
    const unchanged = await readDetails(directory);
    if (
      unchanged.dev !== directoryDetails.dev ||
      unchanged.ino !== directoryDetails.ino ||
      canonicalJson((await readDirectory(directory)).sort()) !==
        canonicalJson([...initial].sort())
    )
      throw new TypeError('pre-capture bootstrap transaction changed');
    if (
      phaseTemporaries.length === 1 &&
      !'captured\n'.startsWith(
        await readStateFile(join(directory, phaseTemporaries[0]), 'utf8')
      )
    )
      refuse();
    const handle = await open(join(directory, marker), 'wx', 0o600);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncParent(directory);
  }
  for (const name of (await readDirectory(directory)).sort()) {
    if (name === marker) continue;
    if (!allowed.has(name)) refuse();
    if (!privateDetails(await readDetails(join(directory, name)))) refuse();
    await removeFile(join(directory, name));
    await syncParent(directory);
  }
  await removeFile(join(directory, marker));
  await syncParent(directory);
  await removeDirectory(directory);
  await syncParent(dirname(directory));
}
