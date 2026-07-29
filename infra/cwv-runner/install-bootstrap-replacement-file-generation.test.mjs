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
        renameFile: () => Promise.reject(interrupted),
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

  const stateC = stateFor('c'.repeat(40), cBytes);
  assert.equal(
    await replaceBootstrapFile(
      { currentDirectory: '/state/generation-c', destination, bytes: cBytes },
      {
        readState: async () => stateC,
        readIntent: async () => intentFor(stateC),
        readProjection: projection,
        temporaryId: () => 'attempt-c',
        chownFile: async () => undefined,
      }
    ),
    'replaced'
  );
  assert.deepEqual(await readFile(destination), cBytes);
  assert.deepEqual(await readFile(join(root, bTemporary)), bBytes);
});
