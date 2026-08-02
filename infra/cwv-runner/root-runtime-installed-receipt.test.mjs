import assert from 'node:assert/strict';
import test from 'node:test';

import { readInstalledRuntimeReceipt } from './root-runtime-installed-receipt.mjs';

const IMAGE_ID = `sha256:${'a'.repeat(64)}`;

const fail = () => {
  throw new TypeError('root runtime registration adapter refused');
};

test('derives the runtime receipt only from the installed image and manifest rows', async () => {
  const files = new Map([
    [
      '/srv/baci-cwv/image-receipt.json',
      Buffer.from(JSON.stringify({ imageId: IMAGE_ID })),
    ],
    [
      '/srv/baci-cwv/receipts/runner-runtime/runner-runtime-manifest.json',
      Buffer.from(
        JSON.stringify({
          files: [
            { path: 'bin/Runner.Listener', sha256: '1'.repeat(64) },
            { path: 'externals/node24/bin/node', sha256: '2'.repeat(64) },
          ],
        })
      ),
    ],
  ]);
  const receipt = await readInstalledRuntimeReceipt({
    dependencies: { readRootRuntimeOwnedFile: async (path) => files.get(path) },
    fail,
  });
  assert.deepEqual(JSON.parse(receipt), {
    executables: {
      listener: {
        path: '/opt/runner/bin/Runner.Listener',
        sha256: '1'.repeat(64),
      },
      node: { path: '/opt/node/bin/node', sha256: '2'.repeat(64) },
    },
    imageId: IMAGE_ID,
    schemaVersion: 1,
  });
});

test('rejects an installed manifest whose required executable digest is absent', async () => {
  await assert.rejects(
    readInstalledRuntimeReceipt({
      dependencies: {
        readRootRuntimeOwnedFile: async (path) =>
          path.endsWith('image-receipt.json')
            ? Buffer.from(JSON.stringify({ imageId: IMAGE_ID }))
            : Buffer.from('{"files":[]}'),
      },
      fail,
    }),
    /root runtime registration adapter refused/
  );
});

test('rejects an installed image receipt whose image ID is absent', async () => {
  const files = new Map([
    ['/srv/baci-cwv/image-receipt.json', Buffer.from('{}')],
    [
      '/srv/baci-cwv/receipts/runner-runtime/runner-runtime-manifest.json',
      Buffer.from(
        JSON.stringify({
          files: [
            { path: 'bin/Runner.Listener', sha256: '1'.repeat(64) },
            { path: 'externals/node24/bin/node', sha256: '2'.repeat(64) },
          ],
        })
      ),
    ],
  ]);

  await assert.rejects(
    readInstalledRuntimeReceipt({
      dependencies: {
        readRootRuntimeOwnedFile: async (path) => files.get(path),
      },
      fail,
    }),
    /root runtime registration adapter refused/
  );
});

test('rejects an installed image receipt whose image ID is malformed', async () => {
  const files = new Map([
    [
      '/srv/baci-cwv/image-receipt.json',
      Buffer.from('{"imageId":"sha256:latest"}'),
    ],
    [
      '/srv/baci-cwv/receipts/runner-runtime/runner-runtime-manifest.json',
      Buffer.from(
        JSON.stringify({
          files: [
            { path: 'bin/Runner.Listener', sha256: '1'.repeat(64) },
            { path: 'externals/node24/bin/node', sha256: '2'.repeat(64) },
          ],
        })
      ),
    ],
  ]);

  await assert.rejects(
    readInstalledRuntimeReceipt({
      dependencies: {
        readRootRuntimeOwnedFile: async (path) => files.get(path),
      },
      fail,
    }),
    /root runtime registration adapter refused/
  );
});
