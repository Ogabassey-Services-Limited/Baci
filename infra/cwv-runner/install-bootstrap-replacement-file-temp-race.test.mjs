import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rename,
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

test('does not roll back over a substituted destination inode', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-temp-race-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const attacker = join(root, 'attacker');
  const prepared = join(root, 'prepared');
  const oldBytes = Buffer.from('old\n');
  const newBytes = Buffer.from('new\n');
  const attackerBytes = Buffer.from('attacker\n');
  await writeFile(destination, oldBytes, { mode: 0o600 });
  await writeFile(attacker, attackerBytes, { mode: 0o600 });
  const metadata = async (path) => ({
    sha256: sha256(await readFile(path)),
    mode: (await stat(path)).mode.toString(8).slice(-3).padStart(4, '0'),
    owner: 'root:root',
  });
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: await metadata(destination) },
    files: {
      [destination]: {
        sha256: sha256(newBytes),
        mode: '0600',
        owner: 'root:root',
      },
    },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let exchanges = 0;

  await assert.rejects(
    replaceBootstrapFile(
      { currentDirectory: '/state/current', destination, bytes: newBytes },
      {
        readState: async () => state,
        readIntent: async () => intent,
        readProjection: async (files) =>
          Object.fromEntries(
            await Promise.all(
              Object.keys(files).map(async (path) => [
                path,
                await metadata(path),
              ])
            )
          ),
        exchangeFile: async (left, right) => {
          exchanges += 1;
          if (exchanges === 1) {
            await rename(left, prepared);
            await rename(attacker, left);
          }
          await exchangeTestPaths(left, right);
        },
        chownFile: async () => undefined,
      }
    ),
    /installed bootstrap replacement drift/
  );
  assert.equal(exchanges, 1);
  assert.deepEqual(await readFile(destination), attackerBytes);
  assert.deepEqual(await readFile(prepared), newBytes);
});
