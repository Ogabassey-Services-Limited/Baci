import { open, readdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { beginBootstrap, readBootstrapState } from './install-bootstrap.mjs';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';

const TRANSACTION = /^bootstrap-[0-9a-f]{12}$/;
const LEGACY_PLAN = /^\.plan\.[A-Za-z0-9]{6}$/;

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
  const names = await listStateDirectories(stateRoot);
  if (names.some((name) => !TRANSACTION.test(name)))
    throw new TypeError('invalid bootstrap replacement state inventory');

  const planRoot = dirname(stateRoot);
  const legacy = (await listPlanDirectories(planRoot)).filter((name) =>
    LEGACY_PLAN.test(name)
  );
  for (const name of legacy) {
    const file = join(planRoot, name);
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
      !names.includes(input.transactionId) ||
      !bytes.equals(Buffer.from(`${JSON.stringify(input)}\n`))
    )
      throw new TypeError('invalid legacy bootstrap plan');
    const capture = beginBootstrap(input);
    const state = await readState(join(stateRoot, input.transactionId));
    if (state.captureSha256 !== capture.captureSha256)
      throw new TypeError('invalid legacy bootstrap plan');
  }
  for (const name of legacy) await removeFile(join(planRoot, name));
  if (legacy.length) await syncPlanRoot(planRoot);
  return names;
}
