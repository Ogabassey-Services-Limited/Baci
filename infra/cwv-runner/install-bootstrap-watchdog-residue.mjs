import { createHash } from 'node:crypto';
import { lstat, open, readdir, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';
import { readBootstrapReplacementIntent } from './install-bootstrap-replacement-controller.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const PREFIX = '.baci-cwv-watchdog-v1-';
const PATTERN =
  /^\.baci-cwv-watchdog-v1-([0-9a-f]{64})-([0-9a-f]{64})-([A-Za-z0-9]{6})$/;
const LEGACY_PREFIX = '.baci-cwv-watchdog.';
const LEGACY_PATTERN = /^\.baci-cwv-watchdog\.[A-Za-z0-9]{6}$/;
const stateDigest = (state) =>
  state?.phase === 'complete' ? state.receiptSha256 : state?.captureSha256;
const sameIdentity = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mode === right.mode &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.nlink === right.nlink &&
  left.ctimeMs === right.ctimeMs;
const mode = (details) => details.mode & 0o777;

async function readExpectedWatchdogBytes(
  state,
  destination,
  sourceRoot,
  readPinnedFile
) {
  const template = (
    await readPinnedFile(
      join(sourceRoot, state.sourceSha, basename(destination))
    )
  ).bytes.toString('utf8');
  const token = '@BACI_CWV_SOURCE_SHA@';
  if (template.split(token).length !== 2)
    throw new TypeError('watchdog render residue authority drift');
  const bytes = Buffer.from(template.replace(token, state.sourceSha));
  if (
    bytes.length > 1024 * 1024 ||
    sha256(bytes) !== state.files?.[destination]?.sha256
  )
    throw new TypeError('watchdog render residue authority drift');
  return bytes;
}

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function reconcileBootstrapWatchdogResidue(
  { currentDirectory, destination, sourceRoot = '/srv/baci-cwv/source' },
  descriptor = {}
) {
  const dependencies = {
    listDirectory: descriptor.listDirectory ?? readdir,
    readIntent: descriptor.readIntent ?? readBootstrapReplacementIntent,
    readPinnedFile: descriptor.readPinnedFile ?? readPinnedBootstrapFile,
    readExpectedBytes:
      descriptor.readExpectedBytes ?? readExpectedWatchdogBytes,
    readState: descriptor.readState ?? readBootstrapState,
    removeFile: descriptor.removeFile ?? rm,
    statFile: descriptor.statFile ?? lstat,
    syncDirectory: descriptor.syncDirectory ?? syncDirectory,
  };
  const [current, intent] = await Promise.all([
    dependencies.readState(currentDirectory),
    descriptor.intent ?? dependencies.readIntent(currentDirectory),
  ]);
  const currentRow = intent.authorityChain?.at(-1);
  if (
    current?.sourceSha !== intent.sourceSha ||
    current?.captureSha256 !== intent.captureSha256 ||
    current?.policyFileSha256 !== intent.policyFileSha256 ||
    sha256(JSON.stringify(Object.keys(current?.files ?? {}).sort())) !==
      intent.pathSetSha256 ||
    !current?.files?.[destination] ||
    currentRow?.sourceSha !== current.sourceSha ||
    currentRow?.stateSha256 !== stateDigest(current) ||
    !intent.transitionPaths?.includes(destination)
  )
    throw new TypeError('watchdog render residue authority drift');
  const states = new Map();
  for (const row of intent.authorityChain) {
    const directory = join(
      dirname(currentDirectory),
      `bootstrap-${row.sourceSha.slice(0, 12)}`
    );
    const state = await dependencies.readState(directory);
    if (
      state?.sourceSha !== row.sourceSha ||
      stateDigest(state) !== row.stateSha256
    )
      throw new TypeError('watchdog render residue authority drift');
    states.set(row.sourceSha, state);
  }
  const authorizedStates = [...states.values()];
  if (
    authorizedStates.some(
      (state) =>
        state.files?.[destination]?.mode !== '0644' ||
        state.files[destination].owner !== 'root:root'
    )
  )
    throw new TypeError('watchdog render residue authority drift');
  const directory = dirname(destination);
  const expectedDestination = sha256(destination);
  let removed = false;
  for (const entry of (await dependencies.listDirectory(directory)).sort()) {
    const legacy = entry.startsWith(LEGACY_PREFIX);
    if (!entry.startsWith(PREFIX) && !legacy) continue;
    const match = PATTERN.exec(entry);
    if (
      (!match && (!legacy || !LEGACY_PATTERN.test(entry))) ||
      (match && match[1] !== expectedDestination)
    )
      throw new TypeError('watchdog render temporary drift');
    const path = join(directory, entry);
    const first = await dependencies.readPinnedFile(path);
    const contentSha256 = sha256(first.bytes);
    const exact = authorizedStates.find(
      (state) =>
        state.files[destination].sha256 === contentSha256 &&
        (!match || match[2] === contentSha256)
    );
    let permitted = exact ? first.bytes : null;
    if (!permitted) {
      const candidates = match
        ? authorizedStates.filter(
            (state) => state.files[destination].sha256 === match[2]
          )
        : authorizedStates;
      const expected = await Promise.all(
        candidates.map((state) =>
          dependencies.readExpectedBytes(
            state,
            destination,
            sourceRoot,
            dependencies.readPinnedFile
          )
        )
      );
      permitted = expected.find(
        (bytes) =>
          first.bytes.length < bytes.length &&
          first.bytes.equals(bytes.subarray(0, first.bytes.length))
      );
    }
    if (
      !permitted ||
      first.bytes.length > 1024 * 1024 ||
      first.details.uid !== 0 ||
      first.details.gid !== 0 ||
      ![0o600, 0o644].includes(mode(first.details)) ||
      ![1, 2].includes(first.details.nlink) ||
      (first.details.nlink === 2 &&
        (mode(first.details) !== 0o644 ||
          first.bytes.length !== permitted.length))
    )
      throw new TypeError('watchdog render temporary drift');
    if (first.details.nlink === 2) {
      const installed = await dependencies.readPinnedFile(destination);
      if (
        installed.details.dev !== first.details.dev ||
        installed.details.ino !== first.details.ino ||
        !installed.bytes.equals(first.bytes)
      )
        throw new TypeError('watchdog render temporary drift');
    }
    const second = await dependencies.readPinnedFile(path);
    if (
      !sameIdentity(first.details, second.details) ||
      !first.bytes.equals(second.bytes)
    )
      throw new TypeError('watchdog render temporary drift');
    await dependencies.removeFile(path);
    removed = true;
  }
  if (removed) await dependencies.syncDirectory(directory);
}

async function main(argv) {
  const [currentDirectory, destination, sourceRoot] = argv;
  await reconcileBootstrapWatchdogResidue({
    currentDirectory,
    destination,
    sourceRoot,
  });
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
