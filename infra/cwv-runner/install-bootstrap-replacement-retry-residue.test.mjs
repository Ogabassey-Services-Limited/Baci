import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { authorizeBootstrapReplacementIfNeeded } from './install-bootstrap-replacement-authorize-if-needed.mjs';

const options = {
  stateRoot: '/state',
  root: '/srv/baci-cwv',
  prepareRoot: '/prepare',
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const metadata = (value, mode = '0644') => ({
  sha256: sha256(value),
  mode,
  owner: 'root:root',
});

test('removes an authorized first-install temporary before an all-absent retry returns', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-pristine-residue-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const bytes = Buffer.from('first bootstrap\n');
  const temporary = join(root, '.tmp.A1b2C3');
  const initial = {
    phase: 'captured',
    sourceSha: 'c'.repeat(40),
    captureSha256: '7'.repeat(64),
    prior: { [destination]: { absent: true } },
    files: { [destination]: metadata(bytes, '0600') },
  };
  await writeFile(temporary, bytes, { mode: 0o600 });

  assert.equal(
    await authorizeBootstrapReplacementIfNeeded(
      { ...options, currentDirectory: '/state/bootstrap-cccccccccccc' },
      {
        listDirectories: async () => ['bootstrap-cccccccccccc'],
        readState: async () => initial,
        readProjection: async () => ({
          [temporary]: initial.files[destination],
        }),
      }
    ),
    null
  );
  await assert.rejects(lstat(temporary), { code: 'ENOENT' });
});

test('retires a bound B watchdog render before C returns through the no-op path', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-noop-watchdog-residue-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'baci-cwv-campaign-watchdog@.service');
  const bytes = {
    a: Buffer.from('watchdog A\n'),
    b: Buffer.from('watchdog B\n'),
  };
  const baseline = {
    phase: 'complete',
    sourceSha: 'a'.repeat(40),
    receiptSha256: '1'.repeat(64),
    sourceManifestSha256: '2'.repeat(64),
    policyFileSha256: '3'.repeat(64),
    prior: { [destination]: { absent: true } },
    files: { [destination]: metadata(bytes.a) },
    receipt: {
      sourceSha: 'a'.repeat(40),
      sourceManifestSha256: '2'.repeat(64),
      policyFileSha256: '3'.repeat(64),
      files: { [destination]: metadata(bytes.a) },
    },
  };
  const interrupted = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '4'.repeat(64),
    sourceManifestSha256: baseline.sourceManifestSha256,
    policyFileSha256: baseline.policyFileSha256,
    prior: { [destination]: metadata(bytes.a) },
    files: { [destination]: metadata(bytes.b) },
  };
  const resumed = {
    phase: 'captured',
    sourceSha: 'c'.repeat(40),
    captureSha256: '5'.repeat(64),
    sourceManifestSha256: baseline.sourceManifestSha256,
    policyFileSha256: baseline.policyFileSha256,
    prior: { [destination]: metadata(bytes.a) },
    files: { [destination]: metadata(bytes.a) },
  };
  const states = new Map([
    ['bootstrap-aaaaaaaaaaaa', baseline],
    ['bootstrap-bbbbbbbbbbbb', interrupted],
    ['bootstrap-cccccccccccc', resumed],
  ]);
  const temporary = join(
    root,
    `.baci-cwv-watchdog-v1-${sha256(destination)}-${sha256(bytes.b)}-B2c3D4`
  );
  await writeFile(temporary, bytes.b, { mode: 0o644 });

  assert.equal(
    await authorizeBootstrapReplacementIfNeeded(
      { ...options, currentDirectory: '/state/bootstrap-cccccccccccc' },
      {
        listDirectories: async () => [...states.keys()],
        readState: async (directory) => states.get(directory.split('/').at(-1)),
        readIntent: () => {
          throw new Error('C has no replacement-intent receipt');
        },
        readPinnedFile: async (path) => {
          const details = await lstat(path);
          return {
            bytes: await readFile(path),
            details: { ...details, uid: 0, gid: 0 },
          };
        },
        syncDirectory: async () => undefined,
        readProjection: async () => ({
          [destination]: resumed.files[destination],
        }),
      }
    ),
    null
  );
  await assert.rejects(lstat(temporary), { code: 'ENOENT' });
});
