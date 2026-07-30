import { open, readdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { beginBootstrap, readBootstrapState } from './install-bootstrap.mjs';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';

const TRANSACTION = /^bootstrap-[0-9a-f]{12}$/;
const LEGACY_PLAN = /^\.plan\.(?:[A-Za-z0-9]{6}|[0-9a-f]{32})$/;

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
  const names = stateEntries.filter((name) => TRANSACTION.test(name));

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
  for (const { name, root } of legacyPlans) {
    const file = join(root, name);
    const { bytes, details } = await readPinnedFile(file);
    if (
      bytes.length > 1024 * 1024 ||
      details.uid !== process.getuid() ||
      details.gid !== process.getgid() ||
      (details.mode & 0o777) !== 0o600 ||
      details.nlink !== 1
    )
      throw new TypeError('invalid legacy bootstrap plan');
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
      const state = await readState(join(stateRoot, input.transactionId));
      if (state.captureSha256 !== capture.captureSha256)
        throw new TypeError('invalid legacy bootstrap plan');
    }
  }
  for (const { name, root } of legacyPlans) await removeFile(join(root, name));
  for (const root of new Set(legacyPlans.map(({ root }) => root)))
    await syncPlanRoot(root);
  return names;
}
