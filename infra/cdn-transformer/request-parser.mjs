import path from 'node:path';
import { z } from 'zod';
import {
  ALLOWED_EXTENSIONS,
  AUTO_FORMATS,
  clampInteger,
  DEFAULT_QUALITY,
  MAX_DIMENSION,
  NORMALIZED_PUBLIC_ROOT,
} from './config.mjs';

const transformOptionsSchema = z.object({
  fit: z.enum(['inside', 'cover']),
  format: z.enum(['auto', 'avif', 'jpeg', 'jpg', 'png', 'webp']),
  height: z.number().int().min(16).max(MAX_DIMENSION).optional(),
  quality: z.number().int().min(1).max(100),
  width: z.number().int().min(16).max(MAX_DIMENSION).optional(),
});

function parseAcceptedImageFormats(acceptHeader) {
  return acceptHeader
    .split(',')
    .map((entry, index) => {
      const [rawType, ...parameters] = entry.split(';');
      const mediaType = rawType.trim().toLowerCase();
      let quality = 1;

      for (const parameter of parameters) {
        const [rawKey, rawValue] = parameter.split('=');
        if (rawKey?.trim().toLowerCase() !== 'q') {
          continue;
        }

        const parsedQuality = Number.parseFloat(rawValue);
        if (Number.isFinite(parsedQuality)) {
          quality = Math.max(0, Math.min(1, parsedQuality));
        }
      }

      return {
        format: AUTO_FORMATS.get(mediaType),
        index,
        quality,
      };
    })
    .filter((entry) => entry.format && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
}

function parseOptions(rawOptions) {
  const options = new Map();

  for (const entry of rawOptions.split(',')) {
    const [rawKey, rawValue] = entry.split('=');
    if (!rawKey || rawValue === undefined) {
      continue;
    }
    options.set(rawKey.trim().toLowerCase(), rawValue.trim().toLowerCase());
  }

  const requestedFormat = options.get('format') || options.get('f') || 'auto';
  return transformOptionsSchema.parse({
    fit: options.get('fit') === 'cover' ? 'cover' : 'inside',
    format: ['auto', 'avif', 'jpeg', 'jpg', 'png', 'webp'].includes(
      requestedFormat
    )
      ? requestedFormat
      : 'auto',
    height: clampInteger(
      options.get('height') || options.get('h'),
      undefined,
      16,
      MAX_DIMENSION
    ),
    quality: clampInteger(
      options.get('quality') || options.get('q'),
      DEFAULT_QUALITY,
      1,
      100
    ),
    width: clampInteger(
      options.get('width') || options.get('w'),
      undefined,
      16,
      MAX_DIMENSION
    ),
  });
}

function hasEncodedTraversalBypass(sourcePath) {
  return (
    sourcePath.includes('\\') ||
    sourcePath.includes('//') ||
    /%(?:2e|2f|5c)/i.test(sourcePath)
  );
}

export function pickFormat(requestedFormat, acceptHeader, sourceExtension) {
  if (requestedFormat === 'jpg') {
    return 'jpeg';
  }

  if (requestedFormat !== 'auto') {
    return requestedFormat;
  }

  const [preferredFormat] = parseAcceptedImageFormats(acceptHeader);
  if (preferredFormat?.format) {
    return preferredFormat.format;
  }

  if (sourceExtension === '.png') {
    return 'png';
  }

  return 'jpeg';
}

export function parseRequestPath(requestUrl) {
  const url = new URL(requestUrl, 'http://cdn.ogabassey.com');

  if (url.pathname === '/healthz') {
    return { healthCheck: true };
  }

  if (!url.pathname.startsWith('/image/')) {
    return { error: 'Not found', statusCode: 404 };
  }

  const rest = url.pathname.slice('/image/'.length);
  const separatorIndex = rest.indexOf('/');
  if (separatorIndex === -1) {
    return { error: 'Missing source path', statusCode: 400 };
  }

  const rawOptions = rest.slice(0, separatorIndex);
  const rawSourcePath = rest.slice(separatorIndex + 1);
  let sourcePath;
  try {
    sourcePath = decodeURIComponent(rawSourcePath);
  } catch {
    return { error: 'Invalid source path', statusCode: 400 };
  }

  if (
    !sourcePath ||
    sourcePath.includes('\0') ||
    sourcePath.startsWith('/') ||
    hasEncodedTraversalBypass(sourcePath)
  ) {
    return { error: 'Invalid source path', statusCode: 400 };
  }

  const absoluteSourcePath = path.resolve(NORMALIZED_PUBLIC_ROOT, sourcePath);
  if (
    absoluteSourcePath !== NORMALIZED_PUBLIC_ROOT &&
    !absoluteSourcePath.startsWith(`${NORMALIZED_PUBLIC_ROOT}${path.sep}`)
  ) {
    return { error: 'Invalid source path', statusCode: 400 };
  }

  const extension = path.extname(absoluteSourcePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { error: 'Unsupported image type', statusCode: 415 };
  }

  return {
    absoluteSourcePath,
    extension,
    options: parseOptions(rawOptions),
    sourcePath,
  };
}
