import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

export const HOST = process.env.CDN_TRANSFORMER_HOST || '127.0.0.1';
export const PORT = Number.parseInt(
  process.env.CDN_TRANSFORMER_PORT || '8095',
  10
);
export const PUBLIC_ROOT = path.resolve(
  process.env.CDN_PUBLIC_ROOT || path.join(process.cwd(), 'public')
);
export const CACHE_ROOT = path.resolve(
  process.env.CDN_TRANSFORMER_CACHE_ROOT ||
    path.join(os.tmpdir(), 'baci-cdn-transformer', 'image-transform')
);
export const NORMALIZED_PUBLIC_ROOT = path.resolve(PUBLIC_ROOT);
export const MAX_DIMENSION = 3840;
export const DEFAULT_QUALITY = 75;
export const MAX_TRANSFORM_SIZE_BYTES = clampInteger(
  process.env.CDN_TRANSFORMER_MAX_SOURCE_BYTES,
  25 * 1024 * 1024,
  1024,
  100 * 1024 * 1024
);
export const TRANSFORM_TIMEOUT_MS = clampInteger(
  process.env.CDN_TRANSFORMER_TIMEOUT_MS,
  15_000,
  1000,
  120_000
);
export const MAX_CONCURRENT_TRANSFORMS = clampInteger(
  process.env.CDN_TRANSFORMER_MAX_CONCURRENT,
  2,
  1,
  8
);
export const CORS_ALLOWED_ORIGIN =
  process.env.CDN_TRANSFORMER_CORS_ORIGIN || 'https://ogabassey.com';
export const ALLOWED_EXTENSIONS = new Set([
  '.avif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);
export const CONTENT_TYPES = {
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
export const AUTO_FORMATS = new Map([
  ['image/avif', 'avif'],
  ['image/webp', 'webp'],
]);

export function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ALLOWED_ORIGIN,
  };
}
