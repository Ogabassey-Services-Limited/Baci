import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';
import { exchangeTestPaths } from './install-bootstrap-replacement-file.test-helper.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = (bytes) => ({
  mode: '0600',
  owner: 'root:root',
  sha256: sha256(bytes),
});

test('recovers generation C without claiming an interrupted generation B temporary', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-generation-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const oldBytes = Buffer.from('generation-a\n');
  const bBytes = Buffer.from('generation-b\n');
  const cBytes = Buffer.from('generation-c\n');
  await writeFile(destination, oldBytes, { mode: 0o600 });
  await chmod(destination, 0o600);

  const stateFor = (sourceSha, bytes) => ({
    phase: 'captured',
    sourceSha,
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(bytes) },
  });
  const intentFor = (state) => ({
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  });
  const projection = async (files) => {
    const result = {};
    for (const path of Object.keys(files)) {
      const details = await stat(path);
      result[path] = {
        sha256: sha256(await readFile(path)),
        mode: (details.mode & 0o777).toString(8).padStart(4, '0'),
        owner: 'root:root',
      };
    }
    return result;
  };

  const stateB = stateFor('b'.repeat(40), bBytes);
  const interrupted = new Error('simulated interruption before publication');
  await assert.rejects(
    replaceBootstrapFile(
      { currentDirectory: '/state/generation-b', destination, bytes: bBytes },
      {
        readState: async () => stateB,
        readIntent: async () => intentFor(stateB),
        readProjection: projection,
        temporaryId: () => 'attempt-b',
        chownFile: async () => undefined,
        exchangeFile: () => Promise.reject(interrupted),
        removeFile: async () => undefined,
      }
    ),
    (error) => error === interrupted
  );
  const [bTemporary] = (await readdir(root)).filter((entry) =>
    entry.startsWith('.baci-bootstrap-replacement-')
  );
  assert.ok(bTemporary);
  assert.deepEqual(await readFile(join(root, bTemporary)), bBytes);
  const unrelatedDestination = join(root, 'watchdog.service');
  const unrelatedTemporary = join(
    root,
    `.baci-bootstrap-replacement-v2-${sha256(unrelatedDestination)}-${sha256(bBytes)}-unrelated`
  );
  await writeFile(unrelatedTemporary, bBytes, { mode: 0o600 });

  const stateC = stateFor('c'.repeat(40), cBytes);
  assert.equal(
    await replaceBootstrapFile(
      { currentDirectory: '/state/generation-c', destination, bytes: cBytes },
      {
        readState: async () => stateC,
        readIntent: async () => intentFor(stateC),
        readProjection: projection,
        exchangeFile: exchangeTestPaths,
        temporaryId: () => 'attempt-c',
        chownFile: async () => undefined,
      }
    ),
    'replaced'
  );
  assert.deepEqual(await readFile(destination), cBytes);
  await assert.rejects(readFile(join(root, bTemporary)), { code: 'ENOENT' });
  assert.deepEqual(await readFile(unrelatedTemporary), bBytes);
});

test('refuses obsolete same-destination residue with inconsistent content or metadata', async () => {
  const destination = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const oldBytes = Buffer.from('generation-a\n');
  const currentBytes = Buffer.from('generation-c\n');
  const obsoleteSha256 = '8'.repeat(64);
  const entry = `.baci-bootstrap-replacement-v2-${sha256(destination)}-${obsoleteSha256}-obsolete`;
  const state = {
    phase: 'captured',
    sourceSha: 'c'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(currentBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let removals = 0;
  for (const actual of [
    { sha256: '7'.repeat(64), mode: '0600', owner: 'root:root' },
    { sha256: obsoleteSha256, mode: '0644', owner: 'root:root' },
    { sha256: obsoleteSha256, mode: '0600', owner: 'unknown' },
  ]) {
    await assert.rejects(
      replaceBootstrapFile(
        {
          currentDirectory: '/state/generation-c',
          destination,
          bytes: currentBytes,
        },
        {
          readState: async () => state,
          readIntent: async () => intent,
          readDirectory: async () => [entry],
          readProjection: async (files) => ({
            [Object.keys(files)[0]]: actual,
          }),
          removeFile: () => {
            removals += 1;
          },
        }
      ),
      /bootstrap replacement temporary drift/
    );
  }
  assert.equal(removals, 0);
});
