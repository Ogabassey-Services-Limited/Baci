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
import { beginBootstrap, readBootstrapState } from './install-bootstrap.mjs';
import { readInstalledProjection } from './install-bootstrap-installed.mjs';
import { planBootstrapReplacement } from './install-bootstrap-replacement.mjs';
import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';
import {
  persistBootstrapReplacementIntent,
  readBootstrapReplacementIntent,
} from './install-bootstrap-replacement-receipt.mjs';
import { validateBootstrapReplacementSourceState } from './install-bootstrap-replacement-source.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

const TRANSACTION = /^bootstrap-[0-9a-f]{12}$/;
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
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const sameKeys = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...CAPTURE_KEYS].sort());
const privateDetails = (details, directory = false) =>
  details.uid === process.getuid() &&
  details.gid === process.getgid() &&
  (details.mode & 0o777) === (directory ? 0o700 : 0o600) &&
  (directory ? details.isDirectory() : details.isFile()) &&
  !details.isSymbolicLink();

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function reconcilePreCapture(directory) {
  const transaction = /^bootstrap-([0-9a-f]{12})$/.exec(basename(directory));
  const directoryDetails = await lstat(directory);
  if (!transaction || !privateDetails(directoryDetails, true))
    throw new TypeError('invalid pre-capture bootstrap transaction');
  const entries = await readdir(directory);
  const phaseTemporaries = entries.filter((name) => PHASE_TEMPORARY.test(name));
  const allowed = new Set([
    'capture.json',
    'capture.sha256',
    'journal.ndjson',
    ...phaseTemporaries,
  ]);
  if (
    phaseTemporaries.length > 1 ||
    entries.some((name) => !allowed.has(name)) ||
    (entries.includes('capture.sha256') && !entries.includes('capture.json')) ||
    (entries.includes('journal.ndjson') &&
      !entries.includes('capture.sha256')) ||
    (phaseTemporaries.length === 1 && !entries.includes('journal.ndjson'))
  )
    throw new TypeError('invalid pre-capture bootstrap transaction');
  for (const name of entries) {
    if (!privateDetails(await lstat(join(directory, name))))
      throw new TypeError('invalid pre-capture bootstrap transaction');
  }
  if (entries.includes('capture.json')) {
    const bytes = await readFile(join(directory, 'capture.json'), 'utf8');
    let stored;
    try {
      stored = JSON.parse(bytes);
    } catch {
      throw new TypeError('invalid pre-capture bootstrap transaction');
    }
    if (!sameKeys(stored) || stored.schemaVersion !== 1)
      throw new TypeError('invalid pre-capture bootstrap transaction');
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
      bytes !== capture.captureBytes
    )
      throw new TypeError('invalid pre-capture bootstrap transaction');
    if (
      entries.includes('capture.sha256') &&
      (await readFile(join(directory, 'capture.sha256'), 'utf8')) !==
        `${capture.captureSha256}\n`
    )
      throw new TypeError('invalid pre-capture bootstrap transaction');
  }
  if (
    entries.includes('journal.ndjson') &&
    (await readFile(join(directory, 'journal.ndjson'), 'utf8')) !== ''
  )
    throw new TypeError('invalid pre-capture bootstrap transaction');
  if (
    phaseTemporaries.length === 1 &&
    (await readFile(join(directory, phaseTemporaries[0]), 'utf8')) !==
      'captured\n'
  )
    throw new TypeError('invalid pre-capture bootstrap transaction');
  const unchanged = await lstat(directory);
  if (
    unchanged.dev !== directoryDetails.dev ||
    unchanged.ino !== directoryDetails.ino ||
    JSON.stringify((await readdir(directory)).sort()) !==
      JSON.stringify([...entries].sort())
  )
    throw new TypeError('pre-capture bootstrap transaction changed');
  for (const name of entries) await unlink(join(directory, name));
  await rmdir(directory);
  await syncDirectory(dirname(directory));
}

export async function authorizeBootstrapReplacement(
  { stateRoot, currentDirectory, downstreamState, sourceRoot, receiptRoot },
  dependencies = {}
) {
  const readState = dependencies.readState ?? readBootstrapState;
  const readProjection = dependencies.readProjection ?? readInstalledProjection;
  const persistIntent =
    dependencies.persistIntent ?? persistBootstrapReplacementIntent;
  const readIntent = dependencies.readIntent ?? readBootstrapReplacementIntent;
  const validateSourceState =
    dependencies.validateSourceState ?? validateBootstrapReplacementSourceState;
  if (!TRANSACTION.test(basename(currentDirectory)))
    throw new TypeError('invalid current bootstrap transaction');
  const nextState = await readState(currentDirectory);
  const names = await readBootstrapReplacementStateInventory(
    stateRoot,
    dependencies
  );
  const states = [nextState];
  for (const name of names) {
    if (name === basename(currentDirectory)) continue;
    const directory = join(stateRoot, name);
    try {
      states.push(await readState(directory));
    } catch {
      await reconcilePreCapture(directory);
    }
  }
  const provenance = new Map();
  for (const state of states)
    provenance.set(
      state.sourceSha,
      await validateSourceState({ state, sourceRoot, receiptRoot })
    );
  const authorityChain = resolveBootstrapReplacementChain(states, nextState);
  const plan = planBootstrapReplacement({
    authorityChain,
    nextState,
    installedProjection: await readProjection(nextState.files),
    downstreamState,
  });
  if (!plan) return null;
  const intent = {
    schemaVersion: 1,
    baselineKind: plan.baselineKind,
    baselineSourceSha: plan.baselineSourceSha,
    baselineStateSha256: plan.baselineStateSha256,
    sourceSha: plan.sourceSha,
    captureSha256: plan.captureSha256,
    installedProjectionSha256: plan.installedProjectionSha256,
    pathSetSha256: plan.pathSetSha256,
    policyFileSha256: plan.policyFileSha256,
    authorityChain: plan.authorityChain.map((row) => ({
      ...row,
      journalTipSha256: provenance.get(row.sourceSha).journalTipSha256,
      sealReceiptSha256: provenance.get(row.sourceSha).sealReceiptSha256,
    })),
    transitionPaths: plan.transitionPaths,
  };
  let existing;
  try {
    existing = await readIntent(currentDirectory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    const existingCurrent = existing.authorityChain.find(
      (row) => row.sourceSha === intent.sourceSha
    );
    const comparableAuthorityChain = intent.authorityChain.map((row) =>
      row.sourceSha === intent.sourceSha && existingCurrent
        ? { ...row, journalTipSha256: existingCurrent.journalTipSha256 }
        : row
    );
    if (
      !same(existing, {
        ...intent,
        authorityChain: comparableAuthorityChain,
        installedProjectionSha256: existing.installedProjectionSha256,
      })
    )
      throw new TypeError('bootstrap replacement intent authority drift');
  } else await persistIntent(currentDirectory, intent);
  return plan;
}
