import { open, readdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { beginBootstrap, readBootstrapState } from './install-bootstrap.mjs';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';

const TRANSACTION = /^bootstrap-[0-9a-f]{12}$/;
const LEGACY_PLAN = /^\.plan\.(?:[A-Za-z0-9]{6}|[0-9a-f]{32})$/;
const LINKED_PLAN = /^\.plan\.([0-9a-f]{32})$/;

const safePlanDetails = (details) =>
  details.uid === process.getuid() &&
  details.gid === process.getgid() &&
  (details.mode & 0o777) === 0o600;

const sameInode = (left, right) =>
  left.dev === right.dev && left.ino === right.ino;

const sameRetryAuthority = (state, capture) =>
  state.transactionId === capture.transactionId &&
  state.sourceSha === capture.sourceSha &&
  state.sourceManifestSha256 === capture.sourceManifestSha256 &&
  state.policyFileSha256 === capture.policyFileSha256 &&
  canonicalJson(state.files) === canonicalJson(capture.files);

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readBootstrapReplacementStateInventory(
  stateRoot,
  dependencies = {}
) {
  const listStateDirectories =
    dependencies.listStateDirectories ??
    dependencies.listDirectories ??
    readdir;
  const listPlanDirectories =
    dependencies.listPlanDirectories ??
    (dependencies.listDirectories ? async () => [] : readdir);
  const readState = dependencies.readState ?? readBootstrapState;
  const readPinnedFile = dependencies.readPinnedFile ?? readPinnedBootstrapFile;
  const removeFile = dependencies.removeFile ?? unlink;
  const syncPlanRoot = dependencies.syncDirectory ?? syncDirectory;
  const stateEntries = await listStateDirectories(stateRoot);
  if (
    stateEntries.some(
      (name) => !TRANSACTION.test(name) && !LEGACY_PLAN.test(name)
    )
  )
    throw new TypeError('invalid bootstrap replacement state inventory');
  let names = stateEntries.filter((name) => TRANSACTION.test(name));

  const planRoot = dirname(stateRoot);
  const parentEntries = await listPlanDirectories(planRoot);
  if (
    parentEntries.some(
      (name) => name.startsWith('.plan.') && !LEGACY_PLAN.test(name)
    )
  )
    throw new TypeError('invalid legacy bootstrap plan');
  const legacyPlans = [
    ...stateEntries
      .filter((name) => LEGACY_PLAN.test(name))
      .map((name) => ({ name, root: stateRoot })),
    ...parentEntries
      .filter((name) => LEGACY_PLAN.test(name))
      .map((name) => ({ name, root: planRoot })),
  ];
  const linkedPlans = [];
  for (const { name, root } of legacyPlans) {
    const file = join(root, name);
    const { bytes, details } = await readPinnedFile(file);
    if (
      bytes.length > 1024 * 1024 ||
      !safePlanDetails(details) ||
      ![1, 2].includes(details.nlink)
    )
      throw new TypeError('invalid legacy bootstrap plan');
    if (details.nlink === 2) {
      const token = root === planRoot ? LINKED_PLAN.exec(name)?.[1] : null;
      const stageName = token ? `.bootstrap-plan-stage.${token}` : null;
      if (!stageName || !parentEntries.includes(stageName))
        throw new TypeError('invalid legacy bootstrap plan');
      const stage = join(root, stageName);
      const staged = await readPinnedFile(stage);
      if (
        !safePlanDetails(staged.details) ||
        staged.details.nlink !== 2 ||
        !sameInode(details, staged.details) ||
        !bytes.equals(staged.bytes)
      )
        throw new TypeError('invalid legacy bootstrap plan');
      linkedPlans.push({ bytes, details, file, root, stage });
    }
    let input;
    try {
      input = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new TypeError('invalid legacy bootstrap plan');
    }
    if (
      !TRANSACTION.test(input?.transactionId) ||
      !bytes.equals(Buffer.from(`${JSON.stringify(input)}\n`))
    )
      throw new TypeError('invalid legacy bootstrap plan');
    const capture = beginBootstrap(input);
    if (input.transactionId !== `bootstrap-${capture.sourceSha.slice(0, 12)}`)
      throw new TypeError('invalid legacy bootstrap plan');
    if (names.includes(input.transactionId)) {
      const directory = join(stateRoot, input.transactionId);
      try {
        const state = await readState(directory);
        if (
          state.captureSha256 !== capture.captureSha256 &&
          (root !== planRoot || !sameRetryAuthority(state, capture))
        )
          throw new TypeError('invalid legacy bootstrap plan');
      } catch (error) {
        if (error.message === 'invalid legacy bootstrap plan') throw error;
        await reconcileBootstrapPreCapture(directory, dependencies);
        names = names.filter((candidate) => candidate !== input.transactionId);
      }
    }
  }
  for (const linked of linkedPlans) await removeFile(linked.stage);
  for (const root of new Set(linkedPlans.map(({ root }) => root)))
    await syncPlanRoot(root);
  for (const linked of linkedPlans) {
    const reconciled = await readPinnedFile(linked.file);
    if (
      !safePlanDetails(reconciled.details) ||
      reconciled.details.nlink !== 1 ||
      !sameInode(linked.details, reconciled.details) ||
      !linked.bytes.equals(reconciled.bytes)
    )
      throw new TypeError('invalid legacy bootstrap plan');
  }
  for (const { name, root } of legacyPlans) await removeFile(join(root, name));
  for (const root of new Set(legacyPlans.map(({ root }) => root)))
    await syncPlanRoot(root);
  return names;
}
