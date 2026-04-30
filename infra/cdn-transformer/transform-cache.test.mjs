import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { CACHE_ROOT } from './config.mjs';
import { buildCachePath, ensureTransformed } from './transform-cache.mjs';

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
