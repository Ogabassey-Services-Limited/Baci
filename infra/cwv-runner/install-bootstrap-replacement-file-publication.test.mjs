import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('refuses to publish over a destination inode swapped after prior projection', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-publication-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const displaced = join(root, 'displaced');
  const swapped = join(root, 'swapped');
  const oldBytes = Buffer.from('old\n');
  const newBytes = Buffer.from('new\n');
  const attackerBytes = Buffer.from('attacker\n');
  await writeFile(destination, oldBytes, { mode: 0o600 });
  await writeFile(swapped, attackerBytes, { mode: 0o600 });
  const metadata = (bytes) => ({
    sha256: sha256(bytes),
    mode: '0600',
    owner: 'root:root',
  });
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(newBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let identityReads = 0;
  await assert.rejects(
    replaceBootstrapFile(
      { currentDirectory: '/state/current', destination, bytes: newBytes },
      {
        readState: async () => state,
        readIntent: async () => intent,
        readProjection: async (files) => {
          const [path] = Object.keys(files);
          const bytes = await readFile(path);
          return {
            [path]: metadata(bytes),
          };
        },
        lstatFile: async (path) => {
          identityReads += 1;
          if (path === destination && identityReads === 3) {
            await rename(destination, displaced);
            await rename(swapped, destination);
          }
          return lstat(path);
        },
        chownFile: async () => undefined,
      }
    ),
    /installed bootstrap replacement drift/
  );
  assert.deepEqual(await readFile(destination), attackerBytes);
  assert.deepEqual(await readFile(displaced), oldBytes);
});
