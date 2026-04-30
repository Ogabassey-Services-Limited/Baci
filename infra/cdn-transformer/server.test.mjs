import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

process.env.CDN_TRANSFORMER_AUTOSTART = 'false';

const { PUBLIC_ROOT } = await import('./config.mjs');
const { handleImageRequest } = await import('./server.mjs');

test('handleImageRequest only treats missing cache files as transform misses', async () => {
  const absoluteSourcePath = path.join(PUBLIC_ROOT, 'source.avif');
  const sourceStat = {
    isFile: () => true,
    mtimeMs: 1,
    size: 1024,
  };
  const cacheError = Object.assign(new Error('Permission denied'), {
    code: 'EACCES',
  });
  let cacheSourcePath;
  let ensureTransformCalls = 0;

  await assert.rejects(
    handleImageRequest(
      { headers: {}, method: 'GET' },
      {},
      {
        absoluteSourcePath,
        extension: '.avif',
        options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
        sourcePath: 'source.avif',
      },
      {
        buildCachePath: ({ sourcePath }) => {
          cacheSourcePath = sourcePath;
          return '/cache/source.webp';
        },
        ensureTransformed: () => {
          ensureTransformCalls += 1;
        },
        pickFormat: () => 'webp',
        sendImageHead: () => undefined,
        serveFile: () => undefined,
        lstat: () => ({ isSymbolicLink: () => false }),
        realpath: (filePath) => filePath,
        stat: (filePath) => {
          if (filePath === absoluteSourcePath) {
            return sourceStat;
          }

          throw cacheError;
        },
      }
    ),
    cacheError
  );

  assert.equal(cacheSourcePath, 'source.avif');
  assert.equal(ensureTransformCalls, 0);
});

test('handleImageRequest rejects normalized source paths outside the public root', async () => {
  let lstatCalls = 0;

  await assert.rejects(
    handleImageRequest(
      { headers: {}, method: 'GET' },
      {},
      {
        absoluteSourcePath: path.resolve(PUBLIC_ROOT, '..', 'secret.avif'),
        extension: '.avif',
        options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
        sourcePath: '../secret.avif',
      },
      {
        buildCachePath: () => '/cache/source.webp',
        ensureTransformed: () => undefined,
        pickFormat: () => 'webp',
        sendImageHead: () => undefined,
        serveFile: () => undefined,
        lstat: () => {
          lstatCalls += 1;
          return { isSymbolicLink: () => false };
        },
        realpath: (filePath) => filePath,
        stat: () => ({ isFile: () => true, mtimeMs: 1, size: 1024 }),
      }
    ),
    { message: 'Not found', statusCode: 404 }
  );

  assert.equal(lstatCalls, 0);
});

test('handleImageRequest resolves source symlinks inside the public root before transforming', async () => {
  const linkedSourcePath = path.join(PUBLIC_ROOT, 'core-assets/link.avif');
  const realSourcePath = path.join(PUBLIC_ROOT, 'core-assets/source.avif');
  const sourceStat = {
    isFile: () => true,
    mtimeMs: 1,
    size: 1024,
  };
  const cacheMiss = Object.assign(new Error('Cache miss'), { code: 'ENOENT' });
  let cacheSourcePath;
  let transformedSourcePath;

  await handleImageRequest(
    { headers: {}, method: 'GET' },
    {},
    {
      absoluteSourcePath: linkedSourcePath,
      extension: '.avif',
      options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
      sourcePath: 'core-assets/link.avif',
    },
    {
      buildCachePath: ({ sourcePath }) => {
        cacheSourcePath = sourcePath;
        return '/cache/source.webp';
      },
      ensureTransformed: (sourcePath) => {
        transformedSourcePath = sourcePath;
      },
      pickFormat: () => 'webp',
      sendImageHead: () => undefined,
      serveFile: () => undefined,
      lstat: () => ({ isSymbolicLink: () => true }),
      realpath: (filePath) =>
        filePath === PUBLIC_ROOT ? PUBLIC_ROOT : realSourcePath,
      stat: (filePath) => {
        if (filePath === realSourcePath) {
          return sourceStat;
        }

        throw cacheMiss;
      },
    }
  );

  assert.equal(cacheSourcePath, 'core-assets/source.avif');
  assert.equal(transformedSourcePath, realSourcePath);
});

test('handleImageRequest rejects source symlinks that resolve outside the public root', async () => {
  const linkedSourcePath = path.join(PUBLIC_ROOT, 'core-assets/link.avif');
  const outsideSourcePath = path.resolve(PUBLIC_ROOT, '..', 'secret.avif');
  let statCalls = 0;
  let ensureTransformCalls = 0;

  await assert.rejects(
    handleImageRequest(
      { headers: {}, method: 'GET' },
      {},
      {
        absoluteSourcePath: linkedSourcePath,
        extension: '.avif',
        options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
        sourcePath: 'core-assets/link.avif',
      },
      {
        buildCachePath: () => '/cache/source.webp',
        ensureTransformed: () => {
          ensureTransformCalls += 1;
        },
        pickFormat: () => 'webp',
        sendImageHead: () => undefined,
        serveFile: () => undefined,
        lstat: () => ({ isSymbolicLink: () => true }),
        realpath: (filePath) =>
          filePath === PUBLIC_ROOT ? PUBLIC_ROOT : outsideSourcePath,
        stat: () => {
          statCalls += 1;
          return { isFile: () => true, mtimeMs: 1, size: 1024 };
        },
      }
    ),
    { message: 'Not found', statusCode: 404 }
  );

  assert.equal(statCalls, 0);
  assert.equal(ensureTransformCalls, 0);
});

test('handleImageRequest rejects symlinks that resolve to unsupported image types', async () => {
  const linkedSourcePath = path.join(PUBLIC_ROOT, 'core-assets/link.avif');
  const realSourcePath = path.join(PUBLIC_ROOT, 'core-assets/source.svg');
  let statCalls = 0;
  let ensureTransformCalls = 0;

  await assert.rejects(
    handleImageRequest(
      { headers: {}, method: 'GET' },
      {},
      {
        absoluteSourcePath: linkedSourcePath,
        extension: '.avif',
        options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
        sourcePath: 'core-assets/link.avif',
      },
      {
        buildCachePath: () => '/cache/source.webp',
        ensureTransformed: () => {
          ensureTransformCalls += 1;
        },
        pickFormat: () => 'webp',
        sendImageHead: () => undefined,
        serveFile: () => undefined,
        lstat: () => ({ isSymbolicLink: () => true }),
        realpath: (filePath) =>
          filePath === PUBLIC_ROOT ? PUBLIC_ROOT : realSourcePath,
        stat: () => {
          statCalls += 1;
          return { isFile: () => true, mtimeMs: 1, size: 1024 };
        },
      }
    ),
    { message: 'Unsupported image type', statusCode: 415 }
  );

  assert.equal(statCalls, 0);
  assert.equal(ensureTransformCalls, 0);
});

test('handleImageRequest rejects source paths under symlinked parents outside the public root', async () => {
  const linkedParentSourcePath = path.join(
    PUBLIC_ROOT,
    'linked-assets/source.avif'
  );
  const outsideSourcePath = path.resolve(PUBLIC_ROOT, '..', 'secret/source.avif');
  let statCalls = 0;
  let ensureTransformCalls = 0;

  await assert.rejects(
    handleImageRequest(
      { headers: {}, method: 'GET' },
      {},
      {
        absoluteSourcePath: linkedParentSourcePath,
        extension: '.avif',
        options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
        sourcePath: 'linked-assets/source.avif',
      },
      {
        buildCachePath: () => '/cache/source.webp',
        ensureTransformed: () => {
          ensureTransformCalls += 1;
        },
        pickFormat: () => 'webp',
        sendImageHead: () => undefined,
        serveFile: () => undefined,
        lstat: () => ({ isSymbolicLink: () => false }),
        realpath: (filePath) =>
          filePath === PUBLIC_ROOT ? PUBLIC_ROOT : outsideSourcePath,
        stat: () => {
          statCalls += 1;
          return { isFile: () => true, mtimeMs: 1, size: 1024 };
        },
      }
    ),
    { message: 'Not found', statusCode: 404 }
  );

  assert.equal(statCalls, 0);
  assert.equal(ensureTransformCalls, 0);
});

test('handleImageRequest accepts sources inside a symlinked public root', async () => {
  const linkedRootSourcePath = path.join(PUBLIC_ROOT, 'core-assets/source.avif');
  const realPublicRoot = path.resolve(PUBLIC_ROOT, '..', 'release-public');
  const realSourcePath = path.join(realPublicRoot, 'core-assets/source.avif');
  const sourceStat = {
    isFile: () => true,
    mtimeMs: 1,
    size: 1024,
  };
  const cacheMiss = Object.assign(new Error('Cache miss'), { code: 'ENOENT' });
  let cacheSourcePath;
  let transformedSourcePath;

  await handleImageRequest(
    { headers: {}, method: 'GET' },
    {},
    {
      absoluteSourcePath: linkedRootSourcePath,
      extension: '.avif',
      options: { fit: 'inside', format: 'webp', quality: 75, width: 229 },
      sourcePath: 'core-assets/source.avif',
    },
    {
      buildCachePath: ({ sourcePath }) => {
        cacheSourcePath = sourcePath;
        return '/cache/source.webp';
      },
      ensureTransformed: (sourcePath) => {
        transformedSourcePath = sourcePath;
      },
      pickFormat: () => 'webp',
      sendImageHead: () => undefined,
      serveFile: () => undefined,
      lstat: () => ({ isSymbolicLink: () => false }),
      realpath: (filePath) =>
        filePath === PUBLIC_ROOT ? realPublicRoot : realSourcePath,
      stat: (filePath) => {
        if (filePath === realSourcePath) {
          return sourceStat;
        }

        throw cacheMiss;
      },
    }
  );

  assert.equal(cacheSourcePath, 'core-assets/source.avif');
  assert.equal(transformedSourcePath, realSourcePath);
});
