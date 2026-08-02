import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';
import { exchangeTestPaths } from './install-bootstrap-replacement-file.test-helper.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('cleans a partial temporary without masking initial write failures', async (context) => {
  for (const failurePoint of ['write', 'sync']) {
    const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-initial-write-'));
    context.after(() => rm(root, { recursive: true, force: true }));
    const destination = join(root, 'bootstrap.sha256');
    const unrelated = join(root, 'unrelated');
    const oldBytes = Buffer.from('old\n');
    const newBytes = Buffer.from('new\n');
    await Promise.all([
      writeFile(destination, oldBytes, { mode: 0o600 }),
      writeFile(unrelated, 'keep'),
    ]);
    const metadata = (bytes) => ({
      mode: '0600',
      owner: 'root:root',
      sha256: sha256(bytes),
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
    const original = new Error(`${failurePoint} failed`);
    const events = [];

    await assert.rejects(
      replaceBootstrapFile(
        { currentDirectory: '/state/current', destination, bytes: newBytes },
        {
          readState: async () => state,
          readIntent: async () => intent,
          readProjection: async () => ({
            [destination]: state.prior[destination],
          }),
          temporaryId: () => failurePoint,
          openFile: async (...args) => {
            const handle = await open(...args);
            return {
              writeFile: async (bytes) => {
                await handle.writeFile(bytes.subarray(0, 1));
                if (failurePoint === 'write') throw original;
              },
              sync: () => {
                if (failurePoint === 'sync') throw original;
                return Promise.resolve();
              },
              close: async () => {
                events.push('close');
                await handle.close();
              },
            };
          },
          removeFile: async (path, options) => {
            events.push(`remove:${path}`);
            await rm(path, options);
            throw new Error('cleanup remove failed');
          },
          syncDirectory: (path) => {
            events.push(`directory:${path}`);
            throw new Error('cleanup directory sync failed');
          },
        }
      ),
      (error) => error === original
    );
    assert.deepEqual(events, [
      'close',
      `remove:${join(root, `.baci-bootstrap-replacement-v2-${sha256(destination)}-${sha256(newBytes)}-${failurePoint}`)}`,
      `directory:${root}`,
    ]);
    assert.deepEqual((await readdir(root)).sort(), [
      'bootstrap.sha256',
      'unrelated',
    ]);
    assert.equal(await readFile(unrelated, 'utf8'), 'keep');
    assert.equal(
      await replaceBootstrapFile(
        { currentDirectory: '/state/current', destination, bytes: newBytes },
        {
          readState: async () => state,
          readIntent: async () => intent,
          readProjection: async (files) =>
            Object.fromEntries(
              await Promise.all(
                Object.keys(files).map(async (path) => {
                  const bytes = await readFile(path);
                  return [
                    path,
                    sha256(bytes) === sha256(newBytes)
                      ? state.files[destination]
                      : state.prior[destination],
                  ];
                })
              )
            ),
          exchangeFile: exchangeTestPaths,
          temporaryId: () => `${failurePoint}-retry`,
          chownFile: async () => undefined,
        }
      ),
      'replaced'
    );
  }
});
