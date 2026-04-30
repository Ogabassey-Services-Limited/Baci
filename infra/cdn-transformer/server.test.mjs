import assert from 'node:assert/strict';
import test from 'node:test';

process.env.CDN_TRANSFORMER_AUTOSTART = 'false';

const { handleImageRequest } = await import('./server.mjs');

test('handleImageRequest only treats missing cache files as transform misses', async () => {
  const sourceStat = {
    isFile: () => true,
    mtimeMs: 1,
    size: 1024,
  };
  const cacheError = Object.assign(new Error('Permission denied'), {
    code: 'EACCES',
  });
  let ensureTransformCalls = 0;

  await assert.rejects(
    handleImageRequest(
      { headers: {}, method: 'GET' },
      {},
      {
        absoluteSourcePath: '/public/source.avif',
        extension: '.avif',
        options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
        sourcePath: 'source.avif',
      },
      {
        buildCachePath: () => '/cache/source.webp',
        ensureTransformed: async () => {
          ensureTransformCalls += 1;
        },
        pickFormat: () => 'webp',
        sendImageHead: async () => {},
        serveFile: async () => {},
        stat: async (filePath) => {
          if (filePath === '/public/source.avif') {
            return sourceStat;
          }

          throw cacheError;
        },
      }
    ),
    cacheError
  );

  assert.equal(ensureTransformCalls, 0);
});
