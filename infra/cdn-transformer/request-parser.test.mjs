import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
process.env.CDN_PUBLIC_ROOT = path.join(testDir, 'public');

const { parseRequestPath, pickFormat } = await import('./request-parser.mjs');

test('pickFormat prefers accepted modern image formats by q value', () => {
  assert.equal(
    pickFormat('auto', 'image/webp;q=0.8,image/avif;q=0.9', '.jpg'),
    'avif'
  );
  assert.equal(pickFormat('jpg', '', '.png'), 'jpeg');
  assert.equal(pickFormat('auto', '', '.png'), 'png');
  assert.equal(pickFormat('auto', '', '.webp'), 'jpeg');
});

test('parseRequestPath returns health checks without image parsing', () => {
  assert.deepEqual(parseRequestPath('/healthz'), { healthCheck: true });
});

test('parseRequestPath parses and clamps transform options through validation', () => {
  const parsed = parseRequestPath(
    '/image/width=229,height=12,quality=200,format=webp,fit=cover/core-assets/products/z-fold-7-jet-black.avif'
  );

  assert.equal(parsed.error, undefined);
  assert.equal(
    parsed.sourcePath,
    'core-assets/products/z-fold-7-jet-black.avif'
  );
  assert.equal(parsed.extension, '.avif');
  assert.deepEqual(parsed.options, {
    fit: 'cover',
    format: 'webp',
    height: 16,
    quality: 100,
    width: 229,
  });
  assert.equal(
    parsed.absoluteSourcePath,
    path.resolve(testDir, 'public/core-assets/products/z-fold-7-jet-black.avif')
  );
});

test('parseRequestPath rejects traversal and unsupported source types', () => {
  for (const requestPath of [
    '/image/width=229/%2e%2e%2fsecret.avif',
    '/image/width=229/%252e%252e%252fsecret.avif',
    '/image/width=229/..%5csecret.avif',
    '/image/width=229/....//secret.avif',
    '/image/width=229/core-assets%00/products/z-fold-7-jet-black.avif',
  ]) {
    assert.deepEqual(parseRequestPath(requestPath), {
      error: 'Invalid source path',
      statusCode: 400,
    });
  }

  assert.deepEqual(parseRequestPath('/image/width=229/logo.svg'), {
    error: 'Unsupported image type',
    statusCode: 415,
  });
});
