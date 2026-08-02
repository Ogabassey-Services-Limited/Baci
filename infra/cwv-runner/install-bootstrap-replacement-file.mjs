import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, chown, link, lstat, open, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { canonicalJson } from './canonical-json.mjs';
import { readBootstrapState } from './install-bootstrap.mjs';
import {
  readInstalledProjection,
  readPinnedBootstrapFile,
} from './install-bootstrap-installed.mjs';
import { readBootstrapReplacementIntent } from './install-bootstrap-replacement-controller.mjs';
import { reconcileBootstrapReplacementResidue } from './install-bootstrap-replacement-residue.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const sameIdentity = (left, right) =>
  left.dev === right.dev && left.ino === right.ino;
const stable = (value) =>
  JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
const owners = { 'root:root': [0, 0], 'root:baci-cwv': [0, 10001] };
const temporaryPrefix = '.baci-bootstrap-replacement-';
const executeFile = promisify(execFile);
const renameExchangeHelper = fileURLToPath(
  new URL('./install-bootstrap-rename-exchange.pl', import.meta.url)
);
const destinationIdentity = (destination) => sha256(destination);
function temporaryName(destination, expectedSha256, attempt) {
  if (!/^[0-9a-f]{64}$/.test(expectedSha256))
    throw new TypeError('invalid replacement expected digest');
  return `${temporaryPrefix}v2-${destinationIdentity(destination)}-${expectedSha256}-${attempt}`;
}

async function syncPath(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function exchangePaths(left, right, descriptor) {
  const platform = descriptor.exchangePlatform ?? process.platform;
  const architecture = descriptor.exchangeArchitecture ?? process.arch;
  if (platform !== 'linux' || architecture !== 'x64')
    throw new TypeError('atomic replacement primitive unavailable');
  const execute = descriptor.executeExchange ?? executeFile;
  await execute('/usr/bin/perl', [renameExchangeHelper, left, right], {
    env: {},
    timeout: 5000,
  });
}
async function atomicReplace(
  destination,
  bytes,
  expected,
  prior,
  dependencies
) {
  const directory = dirname(destination);
  const attempt = dependencies.temporaryId();
  if (!/^[a-z0-9-]+$/.test(attempt))
    throw new TypeError('invalid replacement attempt identity');
  const temporary = join(
    directory,
    temporaryName(destination, expected.sha256, attempt)
  );
  let created = false;
  let handle;
  let preparedIdentity;
  try {
    handle = await dependencies.openFile(temporary, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    preparedIdentity = await handle.stat();
    await handle.close();
    handle = undefined;
    const [uid, gid] = owners[expected.owner] ?? [];
    if (uid === undefined) throw new TypeError('unsupported replacement owner');
    await dependencies.chownFile(temporary, uid, gid);
    await chmod(temporary, Number.parseInt(expected.mode, 8));
    await dependencies.syncMetadata(temporary);
    if (prior.absent) {
      await dependencies.linkFile(temporary, destination);
      await dependencies.syncDirectory(directory);
      await dependencies.removeFile(temporary);
      created = false;
      await dependencies.syncDirectory(directory);
    } else {
      const priorIdentity = await dependencies.readIdentity(destination);
      await dependencies.exchangeFile(temporary, destination);
      created = false;
      const displacedIdentity = await dependencies.readIdentity(temporary);
      const published = await dependencies.readProjection({
        [temporary]: prior,
        [destination]: expected,
      });
      const confirmedDisplacedIdentity =
        await dependencies.readIdentity(temporary);
      if (!sameIdentity(displacedIdentity, confirmedDisplacedIdentity))
        throw new TypeError('installed bootstrap replacement drift');
      if (
        !same(published[temporary], prior) ||
        !same(published[destination], expected)
      ) {
        const destinationIdentity =
          await dependencies.readIdentity(destination);
        const destinationProjection = (
          await dependencies.readProjection({ [destination]: expected })
        )[destination];
        if (!sameIdentity(destinationIdentity, preparedIdentity))
          throw new TypeError('installed bootstrap replacement drift');
        if (!same(destinationProjection, expected))
          throw new TypeError('installed bootstrap replacement drift');
        const rollbackTemporaryIdentity =
          await dependencies.readIdentity(temporary);
        const rollbackTemporaryExpected = sameIdentity(
          displacedIdentity,
          priorIdentity
        )
          ? prior
          : published[temporary];
        const rollbackTemporaryProjection = (
          await dependencies.readProjection({
            [temporary]: rollbackTemporaryExpected,
          })
        )[temporary];
        const confirmedRollbackTemporaryIdentity =
          await dependencies.readIdentity(temporary);
        if (
          !sameIdentity(rollbackTemporaryIdentity, displacedIdentity) ||
          !sameIdentity(
            confirmedRollbackTemporaryIdentity,
            displacedIdentity
          ) ||
          !same(rollbackTemporaryProjection, rollbackTemporaryExpected)
        )
          throw new TypeError('installed bootstrap replacement drift');
        try {
          await dependencies.exchangeFile(temporary, destination);
          await dependencies.syncDirectory(directory);
        } catch {
          throw new TypeError('bootstrap replacement rollback failed');
        }
        throw new TypeError('installed bootstrap replacement drift');
      }
      await dependencies.syncDirectory(directory);
      await dependencies.removeFile(temporary);
      await dependencies.syncDirectory(directory);
    }
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
export async function replaceBootstrapFile(input, descriptor = {}) {
  const dependencies = {
    chownFile: descriptor.chownFile ?? chown,
    exchangeFile:
      descriptor.exchangeFile ??
      ((left, right) => exchangePaths(left, right, descriptor)),
    openFile: descriptor.openFile ?? open,
    readIntent: descriptor.readIntent ?? readBootstrapReplacementIntent,
    readIdentity: descriptor.readIdentity ?? lstat,
    readDirectory: descriptor.readDirectory ?? readdir,
    linkFile: descriptor.linkFile ?? link,
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
  await reconcileBootstrapReplacementResidue(
    {
      destination,
      prior: state.prior[destination],
      expected,
      expectedBytes: bytes,
      authorizedState: { ...state, currentDirectory, destination, intent },
    },
    dependencies
  );
  const actual = (
    await dependencies.readProjection({
      [destination]: expected,
    })
  )[destination];
  if (same(actual, expected)) return 'current';
  if (!same(actual, state.prior[destination]))
    throw new TypeError('installed bootstrap replacement drift');
  await atomicReplace(
    destination,
    bytes,
    expected,
    state.prior[destination],
    dependencies
  );
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
