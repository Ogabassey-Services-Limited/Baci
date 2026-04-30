import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { CACHE_ROOT } from './config.mjs';
import {
  buildCachePath,
  ensureTransformed,
  MAX_CONCURRENT_TRANSFORMS,
  MAX_PENDING_TRANSFORMS,
} from './transform-cache.mjs';

const baseStat = {
  mtimeMs: 1_234_567,
  size: 4_096,
};
const options = {
  fit: 'inside',
  format: 'webp',
  height: undefined,
  quality: 75,
  width: 229,
};

function waitForQueuedWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function createFakeImage(toFilePromise, onDestroy = () => undefined) {
  return {
    avif() {
      return this;
    },
    destroy(error) {
      onDestroy(error);
    },
    jpeg() {
      return this;
    },
    png() {
      return this;
    },
    resize() {
      return this;
    },
    rotate() {
      return this;
    },
    toFile() {
      return toFilePromise;
    },
    webp() {
      return this;
    },
  };
}

function createTransformDeps(overrides = {}) {
  return {
    maxTransformSizeBytes: 25 * 1024 * 1024,
    mkdir: async () => undefined,
    rename: async () => undefined,
    sharpFactory: () => createFakeImage(Promise.resolve({})),
    stat: async () => ({ size: 1 }),
    transformTimeoutMs: 1000,
    unlink: async () => undefined,
    ...overrides,
  };
}

test('buildCachePath is deterministic and varies by transform inputs', () => {
  const firstPath = buildCachePath({
    options,
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: baseStat,
  });
  const repeatedPath = buildCachePath({
    options,
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: baseStat,
  });
  const resizedPath = buildCachePath({
    options: { ...options, width: 320 },
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: baseStat,
  });
  const differentSourcePath = buildCachePath({
    options,
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/iphone-17-pro-max.avif',
    sourceStat: baseStat,
  });
  const repeatedDifferentSourcePath = buildCachePath({
    options,
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/iphone-17-pro-max.avif',
    sourceStat: baseStat,
  });
  const differentQualityPath = buildCachePath({
    options: { ...options, quality: 80 },
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: baseStat,
  });
  const coverFitPath = buildCachePath({
    options: { ...options, fit: 'cover' },
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: baseStat,
  });
  const updatedSourcePath = buildCachePath({
    options,
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: { ...baseStat, mtimeMs: baseStat.mtimeMs + 1 },
  });
  const repeatedUpdatedSourcePath = buildCachePath({
    options,
    outputFormat: 'webp',
    sourcePath: 'core-assets/products/z-fold-7-jet-black.avif',
    sourceStat: { ...baseStat, mtimeMs: baseStat.mtimeMs + 1 },
  });

  assert.equal(firstPath, repeatedPath);
  assert.notEqual(firstPath, resizedPath);
  assert.notEqual(firstPath, differentSourcePath);
  assert.equal(differentSourcePath, repeatedDifferentSourcePath);
  assert.notEqual(firstPath, differentQualityPath);
  assert.notEqual(firstPath, coverFitPath);
  assert.notEqual(firstPath, updatedSourcePath);
  assert.equal(updatedSourcePath, repeatedUpdatedSourcePath);
  assert.equal(path.dirname(firstPath), CACHE_ROOT);
  assert.equal(path.extname(firstPath), '.webp');
});

test('ensureTransformed rejects oversized source images with 413', async () => {
  const deps = createTransformDeps({
    maxTransformSizeBytes: 10,
    sharpFactory: () => {
      throw new Error('oversized sources should not be transformed');
    },
    stat: async () => ({ size: 11 }),
  });

  await assert.rejects(
    ensureTransformed('source.png', 'cache.webp', options, 'webp', deps),
    (error) =>
      error?.statusCode === 413 &&
      error?.message === 'Source image is too large to transform'
  );
});

test('ensureTransformed rejects timed-out image work with 504', async () => {
  let destroyedStatusCode;
  let rejectTransform;
  const transformNeverFinishes = new Promise((_, reject) => {
    rejectTransform = reject;
  });
  const deps = createTransformDeps({
    sharpFactory: () =>
      createFakeImage(transformNeverFinishes, (error) => {
        destroyedStatusCode = error?.statusCode;
        rejectTransform(error);
      }),
    transformTimeoutMs: 10,
  });

  await assert.rejects(
    ensureTransformed('source.png', 'cache.webp', options, 'webp', deps),
    (error) =>
      error?.statusCode === 504 &&
      error?.message === 'Image transform timed out after 10ms'
  );
  assert.equal(destroyedStatusCode, 504);
});

test('ensureTransformed reports timeout before slow transform cleanup settles', async () => {
  let destroyedStatusCode;
  let rejectTransform;
  const slowTransformCleanup = new Promise((_, reject) => {
    rejectTransform = reject;
  });
  const deps = createTransformDeps({
    sharpFactory: () =>
      createFakeImage(slowTransformCleanup, (error) => {
        destroyedStatusCode = error?.statusCode;
      }),
    transformTimeoutMs: 10,
  });
  const transformRequest = ensureTransformed(
    'slow-source.png',
    'slow-cache.webp',
    options,
    'webp',
    deps
  ).then(
    () => ({ status: 'fulfilled' }),
    (error) => ({ error, status: 'rejected' })
  );

  const earlyOutcome = await Promise.race([
    transformRequest,
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({ status: 'still-pending' });
      }, 60);
    }),
  ]);

  rejectTransform(new Error('late transform cleanup'));
  await transformRequest;

  assert.equal(earlyOutcome.status, 'rejected');
  assert.equal(earlyOutcome.error?.statusCode, 504);
  assert.equal(
    earlyOutcome.error?.message,
    'Image transform timed out after 10ms'
  );
  assert.equal(destroyedStatusCode, 504);
});

test('ensureTransformed shares one in-flight transform for the same cache key', async () => {
  let transformStarts = 0;
  let resolveTransform;
  const transformDone = new Promise((resolve) => {
    resolveTransform = resolve;
  });
  const deps = createTransformDeps({
    sharpFactory: () => {
      transformStarts += 1;
      return createFakeImage(transformDone);
    },
  });

  const firstTransform = ensureTransformed(
    'source.png',
    'cache.webp',
    options,
    'webp',
    deps
  );
  const secondTransform = ensureTransformed(
    'source.png',
    'cache.webp',
    options,
    'webp',
    deps
  );

  await waitForQueuedWork();
  resolveTransform({});

  const results = await Promise.allSettled([firstTransform, secondTransform]);
  assert.equal(transformStarts, 1);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'fulfilled');
});

test('ensureTransformed rejects new transforms when the pending queue is full', async () => {
  const requestCount = MAX_CONCURRENT_TRANSFORMS + MAX_PENDING_TRANSFORMS + 1;
  const resolvers = [];
  const deps = createTransformDeps({
    sharpFactory: () =>
      createFakeImage(
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
      ),
    transformTimeoutMs: 60_000,
  });

  const transforms = Array.from({ length: requestCount }, (_, index) =>
    ensureTransformed(
      `source-${index}.png`,
      `cache-${index}.webp`,
      options,
      'webp',
      deps
    )
  );
  const lastTransformError = transforms.at(-1).then(
    () => null,
    (error) => error
  );
  const otherTransformResults = Promise.allSettled(transforms.slice(0, -1));
  let queueError;
  let queueSettled = false;
  lastTransformError.then((error) => {
    queueError = error;
    queueSettled = true;
  });

  await waitForQueuedWork();

  if (!queueSettled || queueError?.statusCode !== 503) {
    // Defensive cleanup: if ensureTransformed did not fail fast, drain resolvers
    // with waitForQueuedWork so the test can report the assertion instead of hanging.
    for (
      let resolvedCount = 0;
      resolvedCount < requestCount;
      resolvedCount += 1
    ) {
      while (resolvers.length === 0) {
        await waitForQueuedWork();
      }

      const resolveTransform = resolvers.shift();
      resolveTransform({});
      await waitForQueuedWork();
    }

    assert.fail('Expected the final transform to fail fast with queue full');
  }

  let resolvedCount = 0;
  while (resolvedCount < requestCount - 1) {
    while (resolvers.length === 0) {
      await waitForQueuedWork();
    }

    const resolveTransform = resolvers.shift();
    resolveTransform({});
    resolvedCount += 1;
    await waitForQueuedWork();
  }

  const results = await otherTransformResults;
  assert.equal(queueError?.statusCode, 503);
  assert.equal(queueError?.message, 'Image transform queue is full');
  assert.ok(results.every((result) => result.status === 'fulfilled'));
});

test('ensureTransformed writes a resized cache file', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'baci-transform-test-'));
  try {
    const sourcePath = path.join(tempDir, 'source.png');
    const cachePath = path.join(tempDir, 'cache', 'source.webp');

    await sharp({
      create: {
        background: { alpha: 1, b: 32, g: 128, r: 255 },
        channels: 4,
        height: 16,
        width: 16,
      },
    })
      .png()
      .toFile(sourcePath);

    await ensureTransformed(
      sourcePath,
      cachePath,
      {
        fit: 'inside',
        height: 8,
        quality: 75,
        width: 8,
      },
      'webp'
    );

    const cacheStat = await stat(cachePath);
    assert.ok(cacheStat.isFile());
    assert.ok(cacheStat.size > 0);

    const outputMeta = await sharp(cachePath).metadata();
    assert.equal(outputMeta.format, 'webp');
    assert.equal(outputMeta.height, 8);
    assert.equal(outputMeta.width, 8);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('ensureTransformed preserves animated WebP frames', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'baci-transform-test-'));
  try {
    const sourcePath = path.join(tempDir, 'source.webp');
    const cachePath = path.join(tempDir, 'cache', 'source.webp');
    const width = 8;
    const pageHeight = 8;
    const pages = 2;
    const channels = 4;
    const framePixels = Buffer.alloc(width * pageHeight * pages * channels);

    for (let y = 0; y < pageHeight * pages; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * channels;
        framePixels[offset] = y < pageHeight ? 255 : 0;
        framePixels[offset + 1] = y < pageHeight ? 0 : 255;
        framePixels[offset + 2] = 0;
        framePixels[offset + 3] = 255;
      }
    }

    await sharp(framePixels, {
      raw: {
        channels,
        height: pageHeight * pages,
        pageHeight,
        width,
      },
    })
      .webp({ delay: [100, 100], loop: 0 })
      .toFile(sourcePath);

    const sourceStat = await stat(sourcePath);
    assert.ok(sourceStat.isFile());

    const sourceMeta = await sharp(sourcePath, { animated: true }).metadata();
    assert.equal(sourceMeta.format, 'webp');
    assert.equal(sourceMeta.pages, pages);
    assert.equal(sourceMeta.pageHeight, pageHeight);
    assert.equal(sourceMeta.height, pageHeight * pages);

    await ensureTransformed(
      sourcePath,
      cachePath,
      {
        fit: 'inside',
        height: 4,
        quality: 75,
        width: 4,
      },
      'webp'
    );

    const outputMeta = await sharp(cachePath, { animated: true }).metadata();
    assert.equal(outputMeta.format, 'webp');
    assert.equal(outputMeta.pages, pages);
    assert.equal(outputMeta.pageHeight, 4);
    assert.equal(outputMeta.height, outputMeta.pageHeight * outputMeta.pages);
    assert.equal(outputMeta.width, 4);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
