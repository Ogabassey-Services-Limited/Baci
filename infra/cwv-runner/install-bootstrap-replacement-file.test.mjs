import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-file-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  const destination = join(root, 'bootstrap.sha256');
  const oldBytes = Buffer.from(`${'1'.repeat(64)}\n`);
  const newBytes = Buffer.from(`${'2'.repeat(64)}\n`);
  await writeFile(destination, oldBytes, { mode: 0o600 });
  await chmod(destination, 0o600);
  const metadata = (bytes) => ({
    mode: '0600',
    owner: 'root:root',
    sha256: sha256(bytes),
  });
  const state = {
    phase: 'captured',
    sourceSha: newSource,
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(newBytes) },
  };
  const intent = {
    schemaVersion: 1,
    baselineKind: 'complete',
    baselineSourceSha: oldSource,
    baselineStateSha256: '4'.repeat(64),
    sourceSha: newSource,
    captureSha256: '3'.repeat(64),
    pathSetSha256: sha256(JSON.stringify([destination])),
    policyFileSha256: '5'.repeat(64),
    transitionPaths: [destination],
  };
  return { destination, intent, newBytes, oldBytes, state };
}

test('atomically replaces only a receipt-bound prior bootstrap file', async (context) => {
  const value = await fixture(context);
  const publication = [];
  const projection = async () => ({
    [value.destination]: {
      sha256: sha256(await readFile(value.destination)),
      mode: (await stat(value.destination)).mode
        .toString(8)
        .slice(-3)
        .padStart(4, '0'),
      owner: 'root:root',
    },
  });

  assert.equal(
    await replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination: value.destination,
        bytes: value.newBytes,
      },
      {
        readState: async () => value.state,
        readIntent: async () => value.intent,
        readProjection: projection,
        chownFile: async () => publication.push('chown'),
        syncMetadata: async (path) => {
          assert.equal((await stat(path)).mode.toString(8).slice(-3), '600');
          publication.push('sync');
        },
      }
    ),
    'replaced'
  );
  assert.deepEqual(publication, ['chown', 'sync']);
  assert.deepEqual(await readFile(value.destination), value.newBytes);
  assert.equal(
    await replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination: value.destination,
        bytes: value.newBytes,
      },
      {
        readState: async () => value.state,
        readIntent: async () => value.intent,
        readProjection: projection,
        chownFile: async () => publication.push('unexpected'),
        syncMetadata: async () => publication.push('unexpected'),
      }
    ),
    'current'
  );
});

test('refuses an unplanned path, unexpected bytes, or third-party installed drift', async (context) => {
  const value = await fixture(context);
  const dependencies = {
    readState: async () => value.state,
    readIntent: async () => value.intent,
    readProjection: async () => ({
      [value.destination]: {
        ...value.state.prior[value.destination],
        sha256: '9'.repeat(64),
      },
    }),
    chownFile: async () => undefined,
  };

  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination: `${value.destination}.other`,
        bytes: value.newBytes,
      },
      dependencies
    ),
    /not authorized/
  );
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination: value.destination,
        bytes: Buffer.from('unexpected'),
      },
      dependencies
    ),
    /replacement bytes mismatch/
  );
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination: value.destination,
        bytes: value.newBytes,
      },
      dependencies
    ),
    /installed bootstrap replacement drift/
  );
});

test('uses an attempt-unique temporary and preserves prior bytes on replacement failure', async (context) => {
  const value = await fixture(context);
  let temporary;

  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
        destination: value.destination,
        bytes: value.newBytes,
      },
      {
        readState: async () => value.state,
        readIntent: async () => value.intent,
        readProjection: async () => ({
          [value.destination]: value.state.prior[value.destination],
        }),
        temporaryId: () => 'attempt-unique',
        chownFile: (path) => {
          temporary = path;
          throw new Error('chown failed');
        },
      }
    ),
    /chown failed/
  );
  assert.match(temporary, /attempt-unique$/);
  assert.deepEqual(await readFile(value.destination), value.oldBytes);
  assert.deepEqual(await readdir(join(value.destination, '..')), [
    'bootstrap.sha256',
  ]);
});
