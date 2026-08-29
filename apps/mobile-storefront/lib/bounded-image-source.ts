import { PixelRatio } from 'react-native';

interface BoundedImageSourceOptions {
  height: number;
  pixelRatio?: number;
  uri: string;
  width: number;
}

export interface ImageDimensions {
  height?: number;
  width?: number;
}

const OGABASSEY_CDN_HOSTNAME = 'cdn.ogabassey.com';
const OGABASSEY_IMAGE_TRANSFORM_PREFIX = '/image/';
const OGABASSEY_PRODUCT_PATH_PREFIX = '/core-assets/products/';
const OGABASSEY_LEGACY_PRODUCT_PATH_PREFIX = '/products/';
const TRANSFORMABLE_EXTENSION = /\.(avif|jpe?g|png|webp)$/i;
const MIN_TRANSFORM_DIMENSION = 16;
const MAX_DECODE_DIMENSION = 3840;
const DEFAULT_TRANSFORM_QUALITY = 75;

/**
 * Resolve a managed product image to a bounded, static fallback format.
 *
 * The storefront receives product assets from the OgaBassey CDN in a number
 * of formats, including AVIF. Android's AVIF frame decoder allocates an
 * additional ARGB bitmap for each frame; on low-memory devices this has been
 * observed to crash in FrameAnimationDrawable even when autoplay is disabled.
 * Managed AVIF (and other catalog) assets are therefore transcoded to the
 * CDN's static JPEG fallback at the requested decode size. PNG remains PNG so
 * alpha channels are not discarded. URLs from other hosts—including signed or
 * transformed Supabase URLs—are returned unchanged.
 */
export function resolveSafeImageUri(
  uri: string,
  dimensions: ImageDimensions = {}
) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return uri;
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== OGABASSEY_CDN_HOSTNAME
  ) {
    return uri;
  }

  const sourcePath = getManagedProductPath(parsed.pathname);
  if (!sourcePath) {
    return uri;
  }

  const options = [
    toTransformDimension(dimensions.width, 'width'),
    toTransformDimension(dimensions.height, 'height'),
    `quality=${DEFAULT_TRANSFORM_QUALITY}`,
    `format=${/\.png$/i.test(sourcePath) ? 'png' : 'jpeg'}`,
  ].filter((option): option is string => Boolean(option));

  return `${parsed.origin}${OGABASSEY_IMAGE_TRANSFORM_PREFIX}${options.join(',')}${sourcePath}${parsed.search}${parsed.hash}`;
}

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

export function createBoundedImageSource({
  height,
  pixelRatio = PixelRatio.get(),
  uri,
  width,
}: BoundedImageSourceOptions) {
  return {
    height: clampDecodeDimension(height * pixelRatio),
    uri,
    width: clampDecodeDimension(width * pixelRatio),
  };
}

/**
 * Build the physical decode dimensions and apply the managed-CDN format guard
 * in one step for catalog surfaces.
 */
export function createSafeBoundedImageSource(
  options: BoundedImageSourceOptions
) {
  const boundedSource = createBoundedImageSource(options);

  return {
    ...boundedSource,
    uri: resolveSafeImageUri(boundedSource.uri, boundedSource),
  };
}

function getManagedProductPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/{2,}/g, '/');
  const unwrappedPath = normalizedPath.startsWith(
    OGABASSEY_IMAGE_TRANSFORM_PREFIX
  )
    ? unwrapTransformPath(normalizedPath)
    : normalizedPath;

  if (!unwrappedPath || !TRANSFORMABLE_EXTENSION.test(unwrappedPath)) {
    return null;
  }

  if (unwrappedPath.startsWith(OGABASSEY_PRODUCT_PATH_PREFIX)) {
    return unwrappedPath;
  }

  if (unwrappedPath.startsWith(OGABASSEY_LEGACY_PRODUCT_PATH_PREFIX)) {
    return `${OGABASSEY_PRODUCT_PATH_PREFIX}${unwrappedPath.slice(OGABASSEY_LEGACY_PRODUCT_PATH_PREFIX.length)}`;
  }

  return null;
}

function unwrapTransformPath(pathname: string) {
  const rest = pathname.slice(OGABASSEY_IMAGE_TRANSFORM_PREFIX.length);
  const separatorIndex = rest.indexOf('/');
  return separatorIndex > 0 ? rest.slice(separatorIndex) : null;
}

function toTransformDimension(value: number | undefined, key: string) {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const dimension = Math.round(value as number);
  if (dimension < MIN_TRANSFORM_DIMENSION) {
    return undefined;
  }

  return `${key}=${Math.min(MAX_DECODE_DIMENSION, dimension)}`;
}

function clampDecodeDimension(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_DECODE_DIMENSION, Math.ceil(value)));
}
