import { createHash } from 'node:crypto';
import { chmod, chown, open, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import {
  readInstalledProjection,
  readPinnedBootstrapFile,
} from './install-bootstrap-installed.mjs';
import { readBootstrapReplacementIntent } from './install-bootstrap-replacement-controller.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const stable = (value) =>
  JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
const owners = {
  'root:root': [0, 0],
  'root:baci-cwv': [0, 10001],
};

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicReplace(destination, bytes, expected, dependencies) {
  const directory = dirname(destination);
  const temporary = join(
    directory,
    `.baci-bootstrap-replacement-${process.pid}`
  );
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    const [uid, gid] = owners[expected.owner] ?? [];
    if (uid === undefined) throw new TypeError('unsupported replacement owner');
    await dependencies.chownFile(temporary, uid, gid);
    await chmod(temporary, Number.parseInt(expected.mode, 8));
    await rename(temporary, destination);
    await syncDirectory(directory);
  } catch (error) {
    await import('node:fs/promises').then(({ rm }) =>
      rm(temporary, { force: true })
    );
    throw error;
  }
}

export async function replaceBootstrapFile(input, descriptor = {}) {
  const dependencies = {
    chownFile: descriptor.chownFile ?? chown,
    readIntent: descriptor.readIntent ?? readBootstrapReplacementIntent,
    readProjection: descriptor.readProjection ?? readInstalledProjection,
    readState: descriptor.readState ?? readBootstrapState,
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
