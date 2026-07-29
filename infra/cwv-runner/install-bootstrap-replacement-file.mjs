import { createHash, randomUUID } from 'node:crypto';
import { chmod, chown, open, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { readBootstrapState } from './install-bootstrap.mjs';
import {
  readInstalledProjection,
  readPinnedBootstrapFile,
} from './install-bootstrap-installed.mjs';
import { readBootstrapReplacementIntent } from './install-bootstrap-replacement-controller.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const stable = (value) =>
  JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
const owners = {
  'root:root': [0, 0],
  'root:baci-cwv': [0, 10001],
};
const temporaryPrefix = '.baci-bootstrap-replacement-';

async function syncPath(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicReplace(destination, bytes, expected, dependencies) {
  const directory = dirname(destination);
  const attempt = dependencies.temporaryId();
  if (!/^[a-z0-9-]+$/.test(attempt))
    throw new TypeError('invalid replacement attempt identity');
  const temporary = join(directory, `${temporaryPrefix}${attempt}`);
  let created = false;
  let handle;
  try {
    handle = await dependencies.openFile(temporary, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const [uid, gid] = owners[expected.owner] ?? [];
    if (uid === undefined) throw new TypeError('unsupported replacement owner');
    await dependencies.chownFile(temporary, uid, gid);
    await chmod(temporary, Number.parseInt(expected.mode, 8));
    await dependencies.syncMetadata(temporary);
    await rename(temporary, destination);
    await dependencies.syncDirectory(directory);
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // Preserve the replacement failure that initiated cleanup.
      }
    }
    if (created) {
      try {
        await dependencies.removeFile(temporary, { force: true });
      } catch {
        // A cleanup failure must not replace the original write failure.
      }
      try {
        await dependencies.syncDirectory(directory);
      } catch {
        // Best effort only: preserve the original replacement failure.
      }
    }
    throw error;
  }
}

async function reconcileTemporaries(destination, expected, dependencies) {
  const directory = dirname(destination);
  const entries = (await dependencies.readDirectory(directory)).sort();
  for (const entry of entries) {
    if (!entry.startsWith('.baci-bootstrap-replacement')) continue;
    if (!/^\.baci-bootstrap-replacement-[a-z0-9-]+$/.test(entry))
      throw new TypeError('unexpected bootstrap replacement residue');
    const temporary = join(directory, entry);
    const actual = (
      await dependencies.readProjection({
        [temporary]: expected,
      })
    )[temporary];
    const permitted = [
      expected,
      { ...expected, mode: '0600', owner: expected.owner },
      { ...expected, mode: '0600', owner: 'root:root' },
    ];
    if (!permitted.some((projection) => same(actual, projection)))
      throw new TypeError('bootstrap replacement temporary drift');
    await dependencies.removeFile(temporary);
    await dependencies.syncDirectory(directory);
  }
}

export async function replaceBootstrapFile(input, descriptor = {}) {
  const dependencies = {
    chownFile: descriptor.chownFile ?? chown,
    openFile: descriptor.openFile ?? open,
    readIntent: descriptor.readIntent ?? readBootstrapReplacementIntent,
    readDirectory: descriptor.readDirectory ?? readdir,
    readProjection: descriptor.readProjection ?? readInstalledProjection,
    readState: descriptor.readState ?? readBootstrapState,
    removeFile: descriptor.removeFile ?? rm,
    syncDirectory: descriptor.syncDirectory ?? syncPath,
    syncMetadata: descriptor.syncMetadata ?? syncPath,
    temporaryId: descriptor.temporaryId ?? randomUUID,
  };
  const { currentDirectory, destination, bytes } = input;
  const [state, intent] = await Promise.all([
    dependencies.readState(currentDirectory),
    dependencies.readIntent(currentDirectory),
  ]);
  if (
    state.phase !== 'captured' ||
    state.sourceSha !== intent.sourceSha ||
    state.captureSha256 !== intent.captureSha256 ||
    state.policyFileSha256 !== intent.policyFileSha256 ||
    sha256(stable(Object.keys(state.files))) !== intent.pathSetSha256 ||
    !intent.transitionPaths.includes(destination) ||
    !state.prior[destination] ||
    !state.files[destination]
  )
    throw new TypeError('bootstrap replacement path not authorized');
  const expected = state.files[destination];
  if (sha256(bytes) !== expected.sha256)
    throw new TypeError('bootstrap replacement bytes mismatch');
  await reconcileTemporaries(destination, expected, dependencies);
  const actual = (
    await dependencies.readProjection({
      [destination]: expected,
    })
  )[destination];
  if (same(actual, expected)) return 'current';
  if (!same(actual, state.prior[destination]))
    throw new TypeError('installed bootstrap replacement drift');
  await atomicReplace(destination, bytes, expected, dependencies);
  const replaced = (
    await dependencies.readProjection({
      [destination]: expected,
    })
  )[destination];
  if (!same(replaced, expected))
    throw new TypeError('bootstrap replacement verification failed');
  return 'replaced';
}

async function main(argv) {
  const [mode, currentDirectory, destination, value] = argv;
  let bytes;
  if (mode === 'source') bytes = (await readPinnedBootstrapFile(value)).bytes;
  else if (mode === 'line') bytes = Buffer.from(`${value}\n`);
  else throw new TypeError('unsupported bootstrap replacement file mode');
  process.stdout.write(
    `${await replaceBootstrapFile({ currentDirectory, destination, bytes })}\n`
  );
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
