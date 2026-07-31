import { createHash } from 'node:crypto';
import { open, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { readBootstrapState } from './install-bootstrap.mjs';
import {
  readInstalledProjection,
  readPinnedBootstrapFile,
} from './install-bootstrap-installed.mjs';
import { retireObsolete } from './install-bootstrap-replacement-temp-authority.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const prefix = '.baci-bootstrap-replacement-';
const boundPattern =
  /^\.baci-bootstrap-replacement-v2-([0-9a-f]{64})-([0-9a-f]{64})-([a-z0-9-]+)$/;
const legacyPattern = /^\.baci-bootstrap-replacement-[a-z0-9-]+$/;
const historicalPattern = /^\.tmp\.[A-Za-z0-9]{6}$/;
const destinationIdentity = (destination) => sha256(destination);
const projections = (expected) => [
  expected,
  { ...expected, mode: '0600', owner: expected.owner },
  { ...expected, mode: '0600', owner: 'root:root' },
];
const resolveExpectedBytes = async (value) =>
  typeof value === 'function' ? await value() : value;

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function reconcileBootstrapReplacementResidue(
  { destination, prior, expected, expectedBytes, authorizedState },
  descriptor = {}
) {
  const dependencies = {
    readDirectory: descriptor.readDirectory ?? readdir,
    readProjection: descriptor.readProjection ?? readInstalledProjection,
    readState: descriptor.readState ?? readBootstrapState,
    readTemporary: descriptor.readTemporary ?? readPinnedBootstrapFile,
    removeFile: descriptor.removeFile ?? rm,
    syncDirectory: descriptor.syncDirectory ?? syncDirectory,
  };
  const directory = dirname(destination);
  const entries = (await dependencies.readDirectory(directory)).sort();
  for (const entry of entries) {
    const historical = historicalPattern.test(entry);
    if (!entry.startsWith(prefix) && !historical) continue;
    const bound = boundPattern.exec(entry);
    const legacy = legacyPattern.test(entry);
    if (!bound && !legacy && !historical)
      throw new TypeError('unexpected bootstrap replacement residue');
    const temporary = join(directory, entry);
    const actual = (
      await dependencies.readProjection({ [temporary]: expected })
    )[temporary];
    if (historical) {
      let permitted = Object.keys(authorizedState.files)
        .filter((path) => dirname(path) === directory)
        .flatMap((path) => [
          authorizedState.prior[path],
          authorizedState.files[path],
        ])
        .filter((projection) => !projection.absent)
        .flatMap(projections)
        .some((projection) => same(actual, projection));
      if (!permitted && expectedBytes !== undefined) {
        const authenticatedBytes = await resolveExpectedBytes(expectedBytes);
        const candidates = Buffer.isBuffer(authenticatedBytes)
          ? [authenticatedBytes]
          : authenticatedBytes;
        if (
          !Array.isArray(candidates) ||
          candidates.some((bytes) => !Buffer.isBuffer(bytes))
        )
          throw new TypeError('invalid bootstrap replacement expected bytes');
        const temporaryFile = await dependencies.readTemporary(temporary);
        const temporaryBytes = temporaryFile.bytes;
        permitted =
          temporaryFile.details.nlink === 1 &&
          actual.mode === '0600' &&
          actual.owner === 'root:root' &&
          candidates.some(
            (bytes) =>
              temporaryBytes.length <= bytes.length &&
              temporaryBytes.equals(bytes.subarray(0, temporaryBytes.length))
          );
      }
      if (!permitted)
        throw new TypeError('bootstrap replacement temporary drift');
      await dependencies.removeFile(temporary);
      await dependencies.syncDirectory(directory);
      continue;
    }
    if (bound && bound[1] !== destinationIdentity(destination)) continue;
    if (bound && bound[2] !== expected.sha256) {
      await retireObsolete(
        actual,
        bound,
        authorizedState,
        temporary,
        dependencies
      );
      continue;
    }
    const permitted = [expected, prior]
      .filter((projection) => !projection.absent)
      .flatMap(projections);
    if (!permitted.some((projection) => same(actual, projection))) {
      const temporaryFile = Buffer.isBuffer(expectedBytes)
        ? await dependencies.readTemporary(temporary)
        : undefined;
      const temporaryBytes = temporaryFile?.bytes;
      const partial =
        temporaryBytes !== undefined &&
        temporaryFile.details.nlink === 1 &&
        actual.mode === '0600' &&
        actual.owner === 'root:root' &&
        temporaryBytes.equals(expectedBytes.subarray(0, temporaryBytes.length));
      if (!partial)
        throw new TypeError('bootstrap replacement temporary drift');
    }
    await dependencies.removeFile(temporary);
    await dependencies.syncDirectory(directory);
  }
}
