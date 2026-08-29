import { resolveSafeImageUri } from './safe-image-uri';

/**
 * Normalize an Expo Image source without changing non-URI sources. The
 * generic return type keeps caller-specific Expo source metadata (headers,
 * cache keys, and so on) intact while allowing catalog URIs to use the safe
 * CDN fallback.
 */
export function resolveSafeImageSource<T>(source: T): T {
  if (Array.isArray(source)) {
    return source.map((entry) => resolveSafeImageSource(entry)) as T;
  }

  if (typeof source === 'string') {
    return resolveSafeImageUri(source) as T;
  }

  if (!source || typeof source !== 'object') {
    return source;
  }

  const sourceRecord = source as Record<string, unknown>;
  if (typeof sourceRecord.uri !== 'string') {
    return source;
  }

  return {
    ...sourceRecord,
    ...(typeof sourceRecord.height === 'number'
      ? { height: clampDecodeDimension(sourceRecord.height) }
      : {}),
    uri: resolveSafeImageUri(sourceRecord.uri, {
      height:
        typeof sourceRecord.height === 'number'
          ? clampDecodeDimension(sourceRecord.height)
          : undefined,
      width:
        typeof sourceRecord.width === 'number'
          ? clampDecodeDimension(sourceRecord.width)
          : undefined,
    }),
    ...(typeof sourceRecord.width === 'number'
      ? { width: clampDecodeDimension(sourceRecord.width) }
      : {}),
  } as T;
}

function clampDecodeDimension(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(3840, Math.ceil(value)));
}
