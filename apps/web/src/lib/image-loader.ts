import { DEFAULT_MEDIA_CDN_ORIGIN } from '@/config/cdn';

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
  preferOgabasseyTransform?: boolean;
}

const OGABASSEY_CDN_HOSTNAME = new URL(DEFAULT_MEDIA_CDN_ORIGIN).hostname;
const DEFAULT_IMAGE_QUALITY = 75;
const MIN_TRANSFORM_WIDTH = 16;
const MAX_TRANSFORM_WIDTH = 3840;
const OGABASSEY_PRODUCT_IMAGE_PATH_PREFIX = '/core-assets/products/';
const TRANSFORMABLE_IMAGE_EXTENSION_PATTERN = /\.(avif|jpe?g|png|webp)$/i;

/**
 * Custom image loader for next/image.
 *
 * Bypasses Vercel's /_next/image proxy for external CDN images that are
 * already optimized (AVIF on Cloudflare CDN, Supabase storage, etc.).
 * Vercel's image optimization servers get blocked by Cloudflare WAF/bot
 * protection, causing OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED (502).
 *
 * With images.loader='custom', this function must return the final URL for
 * every image. Local public assets therefore keep their direct path instead of
 * delegating back to /_next/image, which is reserved for Next's default
 * optimizer pipeline.
 */
export default function imageLoader({
  src,
  width,
  quality,
  preferOgabasseyTransform = false,
}: ImageLoaderParams): string {
  if (typeof src !== 'string') {
    return '';
  }

  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  // External URLs — serve directly from their CDN unless the OgaBassey product
  // image transformer is needed to preserve next/image width-aware srcsets.
  if (src.startsWith('https://') || src.startsWith('http://')) {
    if (isOgabasseyCdnUrl(src)) {
      return (
        buildOgabasseyCdnTransformUrl({
          preferOgabasseyTransform,
          quality,
          src,
          width,
        }) ??
        buildOgabasseyPrebakedImageWidthUrl({ quality, src, width }) ??
        src
      );
    }

    return appendLoaderParams(src, width, quality);
  }

  // Local public assets and other app-local paths must resolve directly when a
  // custom loader is configured. Returning /_next/image here would send them to
  // a route owned by the default loader, which this app intentionally bypasses.
  return appendLoaderParams(src, width, quality);
}

function appendLoaderParams(src: string, width: number, quality?: number) {
  const hashIndex = src.indexOf('#');
  const base = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  const transformWidth = clampDimension(width);
  const transformQuality = clampQuality(quality);

  return `${base}${separator}w=${transformWidth}&q=${transformQuality}${hash}`;
}

function isOgabasseyCdnUrl(src: string): boolean {
  try {
    return new URL(src).hostname === OGABASSEY_CDN_HOSTNAME;
  } catch {
    return false;
  }
}

function buildOgabasseyCdnTransformUrl({
  preferOgabasseyTransform = false,
  src,
  width,
  quality,
}: ImageLoaderParams): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (
    url.hostname !== OGABASSEY_CDN_HOSTNAME ||
    url.pathname.startsWith('/image/') ||
    (!preferOgabasseyTransform &&
      !url.pathname.startsWith(OGABASSEY_PRODUCT_IMAGE_PATH_PREFIX)) ||
    !TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(url.pathname)
  ) {
    return null;
  }

  const transformWidth = clampDimension(width);
  const transformQuality = clampQuality(quality);

  return `${url.origin}/image/width=${transformWidth},quality=${transformQuality},format=auto${url.pathname}${url.search}${url.hash}`;
}

const OGABASSEY_IMAGE_TRANSFORM_PREFIX = '/image/';

/**
 * Pre-baked OgaBassey CDN transform URLs that omit a width (e.g.
 * `/image/format=auto/<path>`) are otherwise returned unchanged, so
 * next/image's srcset would request the same full-resolution asset for every
 * candidate width. Inject the requested width (and a quality default) into the
 * existing transform segment so each srcset entry resolves to a correctly sized
 * image. URLs that already pin an explicit `width=` are left untouched to honor
 * deliberately sized transforms.
 */
function buildOgabasseyPrebakedImageWidthUrl({
  src,
  width,
  quality,
}: ImageLoaderParams): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (
    url.hostname !== OGABASSEY_CDN_HOSTNAME ||
    !url.pathname.startsWith(OGABASSEY_IMAGE_TRANSFORM_PREFIX)
  ) {
    return null;
  }

  const remainder = url.pathname.slice(OGABASSEY_IMAGE_TRANSFORM_PREFIX.length);
  const separatorIndex = remainder.indexOf('/');
  if (separatorIndex <= 0) {
    return null;
  }

  const transformSegment = remainder.slice(0, separatorIndex);
  const assetPath = remainder.slice(separatorIndex);
  if (!TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(assetPath)) {
    return null;
  }

  const params = new Map<string, string>();
  for (const part of transformSegment.split(',')) {
    const [key, value] = part.split('=');
    const trimmedKey = key?.trim();
    if (trimmedKey) {
      params.set(trimmedKey, (value ?? '').trim());
    }
  }

  // Respect deliberately sized transforms — only fill in a missing width.
  if (params.has('width')) {
    return null;
  }

  const existingQuality = Number(params.get('quality'));
  const transformWidth = clampDimension(width);
  const transformQuality = clampQuality(
    quality ?? (Number.isFinite(existingQuality) ? existingQuality : undefined)
  );
  const format = params.get('format') || 'auto';
  const extras = Array.from(params.entries())
    .filter(([key]) => key !== 'width' && key !== 'quality' && key !== 'format')
    .map(([key, value]) => `${key}=${value}`);
  const rebuiltTransform = [
    `width=${transformWidth}`,
    `quality=${transformQuality}`,
    `format=${format}`,
    ...extras,
  ].join(',');

  return `${url.origin}${OGABASSEY_IMAGE_TRANSFORM_PREFIX}${rebuiltTransform}${assetPath}${url.search}${url.hash}`;
}

function clampDimension(width: number): number {
  if (!Number.isFinite(width)) {
    return MAX_TRANSFORM_WIDTH;
  }

  return Math.max(
    MIN_TRANSFORM_WIDTH,
    Math.min(MAX_TRANSFORM_WIDTH, Math.round(width))
  );
}

function clampQuality(quality?: number): number {
  if (quality === undefined || !Number.isFinite(quality)) {
    return DEFAULT_IMAGE_QUALITY;
  }

  return Math.max(1, Math.min(100, Math.round(quality)));
}
