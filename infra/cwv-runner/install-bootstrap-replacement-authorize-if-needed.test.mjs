import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { authorizeBootstrapReplacementIfNeeded } from './install-bootstrap-replacement-authorize-if-needed.mjs';

const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const current = {
  phase: 'captured',
  sourceSha: 'b'.repeat(40),
  captureSha256: '6'.repeat(64),
  prior: {
    [path]: { sha256: '1'.repeat(64), mode: '0600', owner: 'root:root' },
  },
};
const options = {
  stateRoot: '/state',
  currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
  root: '/srv/baci-cwv',
  prepareRoot: '/prepare',
};

test('skips only a fresh all-absent bootstrap and refuses unbound residue', async () => {
  assert.equal(
    await authorizeBootstrapReplacementIfNeeded(options, {
      listDirectories: async () => ['bootstrap-bbbbbbbbbbbb'],
      readState: async () => ({
        ...current,
        prior: { [path]: { absent: true } },
      }),
    }),
    null
  );
  await assert.rejects(
    authorizeBootstrapReplacementIfNeeded(options, {
      listDirectories: async () => ['bootstrap-bbbbbbbbbbbb'],
      readState: async () => current,
    }),
    /prior bootstrap generation required/
  );
});

test('reconciles an interrupted predecessor temporary before an unchanged no-op returns', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-noop-residue-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const bytes = Buffer.from('current\n');
  const interrupted = Buffer.from('interrupted\n');
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const metadata = (value) => ({
    sha256: digest(value),
    mode: '0600',
    owner: 'root:root',
  });
  const noOp = {
    ...current,
    sourceSha: 'c'.repeat(40),
    sourceManifestSha256: '7'.repeat(64),
    policyFileSha256: '8'.repeat(64),
    prior: { [destination]: metadata(bytes) },
    files: { [destination]: metadata(bytes) },
  };
  const predecessor = {
    ...current,
    sourceSha: 'b'.repeat(40),
    captureSha256: '5'.repeat(64),
    sourceManifestSha256: '6'.repeat(64),
    policyFileSha256: noOp.policyFileSha256,
    prior: { [destination]: metadata(bytes) },
    files: { [destination]: metadata(interrupted) },
  };
  const baseline = {
    ...predecessor,
    phase: 'complete',
    sourceSha: 'a'.repeat(40),
    receiptSha256: '4'.repeat(64),
    receipt: {
      sourceSha: 'a'.repeat(40),
      sourceManifestSha256: predecessor.sourceManifestSha256,
      policyFileSha256: noOp.policyFileSha256,
      files: predecessor.prior,
    },
    files: predecessor.prior,
  };
  const temporary = `.baci-bootstrap-replacement-v2-${digest(destination)}-${digest(interrupted)}-generation-b`;
  await writeFile(join(root, temporary), interrupted, { mode: 0o600 });

  assert.equal(
    await authorizeBootstrapReplacementIfNeeded(
      { ...options, currentDirectory: '/state/bootstrap-cccccccccccc' },
      {
        readState: async (directory) =>
          directory.endsWith('aaaaaaaaaaaa')
            ? baseline
            : directory.endsWith('bbbbbbbbbbbb')
              ? predecessor
              : noOp,
        listDirectories: async () => [
          'bootstrap-aaaaaaaaaaaa',
          'bootstrap-bbbbbbbbbbbb',
          'bootstrap-cccccccccccc',
        ],
        readProjection: async (projection) =>
          Object.fromEntries(
            Object.keys(projection).map((candidate) => [
              candidate,
              candidate === join(root, temporary)
                ? metadata(interrupted)
                : metadata(bytes),
            ])
          ),
        readDownstream: () => {
          throw new Error('downstream state must not be inspected');
        },
      }
    ),
    null
  );
  assert.deepEqual(await readdir(root), []);
});
