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

test('retries after process death leaves a bound replacement prefix temporary', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-midwrite-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const priorBytes = Buffer.from('prior bootstrap receipt\n');
  const expectedBytes = Buffer.from('next bootstrap receipt\n');
  await writeFile(destination, priorBytes, { mode: 0o600 });
  await chmod(destination, 0o600);
  const temporary = join(
    root,
    `.baci-bootstrap-replacement-v2-${sha256(destination)}-${sha256(expectedBytes)}-killed-mid-write`
  );
  await writeFile(temporary, expectedBytes.subarray(0, 5), { mode: 0o600 });
  await chmod(temporary, 0o600);
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(priorBytes) },
    files: { [destination]: metadata(expectedBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  const projection = async (files) =>
    Object.fromEntries(
      await Promise.all(
        Object.keys(files).map(async (path) => {
          const details = await stat(path);
          return [
            path,
            {
              mode: (details.mode & 0o777).toString(8).padStart(4, '0'),
              owner: 'root:root',
              sha256: sha256(await readFile(path)),
            },
          ];
        })
      )
    );

  assert.equal(
    await replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination,
        bytes: expectedBytes,
      },
      {
        chownFile: async () => undefined,
        exchangeFile: exchangeTestPaths,
        readIntent: async () => intent,
        readProjection: projection,
        readState: async () => state,
        temporaryId: () => 'retry',
      }
    ),
    'replaced'
  );
  assert.deepEqual(await readFile(destination), expectedBytes);
  assert.deepEqual(await readdir(root), ['bootstrap.sha256']);
});
