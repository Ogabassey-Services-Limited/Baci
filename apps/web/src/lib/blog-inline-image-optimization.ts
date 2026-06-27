import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

/**
 * Inline blog body images (the codex content pipeline) are uploaded as raw PNGs
 * served at `.../inline-N-<hash>.png` with pre-optimized AVIF/WebP siblings at
 * `<src>.avif` / `<src>.webp`. We serve those via a `<picture>` so Cloudflare
 * can cache each format under its own URL (content negotiation on a single URL
 * is cache-unsafe behind Cloudflare).
 *
 * Only rewrite hashed inline images because the hash is the positive signal
 * that generated siblings exist. Never synthesize `<source>` URLs for legacy
 * plain `inline-N` images, external URLs, or featured-image variants. Browsers
 * choose a `<source>` by `srcset`/`type` before fetching and do not retry the
 * `<img>` fallback after a chosen source 404s.
 */
// Accept current `inline-<n>-<hash>.<ext>` URLs. Anchor on the extension so
// generated siblings (…png.avif) and non-inline images (featured variants) are
// excluded.
const INLINE_IMAGE_PATH_PATTERN =
  /\/inline-\d+-[a-z0-9]{8,}\.(?:png|jpe?g)(?:[?#]|$)/i;
// Stale URLs confirmed as 404s in Semrush snapshot 6a3b2fb06ff18731c13fd2c5.
const OGABASSEY_LEGACY_BLOG_CDN_ORIGIN = 'https://cdn.ogabassey.com';
const STALE_OGABASSEY_BLOG_IMAGE_PATHS = new Set([
  '/blog/2023/03/iphone-xr.jpg',
  '/blog/2023/09/Apple-iPhone-15-48MP-02-230912-1024x1024.jpg',
  '/blog/2023/09/Apple-iPhone-15-Pro-lineup-USB-C-connector-cable-230912-1024x1024.jpg',
  '/blog/2023/09/Apple-iPhone-15-Pro-lineup-camera-system-230912-1024x1024.jpg',
  '/blog/2023/09/Apple-iPhone-15-Pro-lineup-color-lineup-230912.jpg',
  '/blog/2023/09/Apple-iPhone-15-lineup-Contact-Posters-230912-1024x1024.jpg',
  '/blog/2023/09/Apple-iPhone-15-lineup-dual-camera-system-230912-1024x1024.jpg',
  '/blog/2023/09/tecno-phantom-v-flip-v-1-1024x800.webp',
  '/blog/2023/10/amjith-s-jA9xWmWv1zE-unsplash-1024x1024.jpg',
  '/blog/2023/10/amjith-s-zHxZ4Lr8eTo-unsplash-1024x1024.jpg',
  '/blog/2023/10/google-pixel-8-pro-11.jpg',
  '/blog/2023/10/image-1.jpeg',
  '/blog/2023/10/image-2.jpeg',
  '/blog/2023/10/image-3.jpeg',
  '/blog/2023/10/image-4.jpeg',
  '/blog/2023/10/image-5.jpeg',
  '/blog/2023/10/image.jpeg',
  '/blog/2023/10/kawal-dhillon-zKf3GzpJhaQ-unsplash-1024x1024.jpg',
  '/blog/2024/01/S24.webp',
  '/blog/2024/06/IMG_4088-1-1024x900.jpg',
  '/blog/2024/06/IMG_4089-1024x1024.jpg',
  '/blog/2024/06/Redmi-13-1-680x365_c.jpg',
  '/blog/2024/06/Redmi-13-4-768x960-1.jpg',
  '/blog/2024/06/Redmi-13-4G-MySmartPrice-1045x549-1-1024x549.jpeg',
  '/blog/2024/06/WhatsApp-Image-2024-06-06-at-3.webp',
  '/blog/2024/06/battery-edited.webp',
  '/blog/2024/06/camera-redmi-copy-1024x909.jpg',
  '/blog/2024/06/redmi-a3x-screen.png',
  '/blog/2024/06/sim-copy-1024x548.jpg',
  '/blog/2024/07/image-2.png',
  '/blog/2024/07/ipad-1oth-gen-2022-scaled.jpg',
  '/blog/2024/07/ipad-2nd-gen-2011.jpeg',
  '/blog/2024/07/ipad-3rd-gen.webp',
  '/blog/2024/07/ipad-4th-gen-.jpg',
  '/blog/2024/07/ipad-5th-gen-2017.png',
  '/blog/2024/07/ipad-6th-gen-2018.png',
  '/blog/2024/07/ipad-7th-gen.png',
  '/blog/2024/07/ipad-8th-gen.png',
  '/blog/2024/07/ipad-9th-gen.png',
  '/blog/2024/07/ipad-mini-1st-gen.jpg',
  '/blog/2024/07/ipad-mini-2.jpeg',
  '/blog/2024/07/ipad-mini-4.jpg',
  '/blog/2024/07/ipad-mini-5-2019.jpg',
  '/blog/2024/07/the-original-ipad-.jpg',
  '/blog/2024/08/11-inch-ipad-m4.jpg',
  '/blog/2024/08/11-inch-ipad-pro-4th-gen.png',
  '/blog/2024/08/12.9-ipad-pro-1st-gen.png',
  '/blog/2024/08/12.922-ipad-pro-2nd-gen-1-2.png',
  '/blog/2024/08/ipad-air-2.webp',
  '/blog/2024/08/ipad-air-3.webp',
  '/blog/2024/08/ipad-air-4.png',
  '/blog/2024/08/ipad-air-5.jpg',
  '/blog/2024/08/ipad-mini-6-1.png',
  '/blog/2024/08/ipad-pro-11-inch-2nd-gen.jpeg',
  '/blog/2024/08/ipad-pro-11-inch-3rd-gen.png',
  '/blog/2024/08/ipad-pro-12-2018.png',
  '/blog/2024/08/ipad-pro-12-9-5th-gen-.png',
  '/blog/2024/08/ipad-pro-2018.png',
  '/blog/2024/08/ipad-pro-4th-gen-12.9.jpeg',
  '/blog/2024/08/ipad-pro-6th-gen-12.922.png',
  '/blog/2024/08/ipad-sair-2.jpeg',
  '/blog/2024/12/05_whatcomesnext-transformed-e1727288153518-1024x809.png',
  '/blog/2024/12/1200_800-1024x800.png',
  '/blog/2024/12/imageye___-_230222-generative-ai-blog-2-1024x756.png',
  '/blog/2024/12/vt3ZaSjzEDoKnjrLftNpPA-1920-80.jpg-1024x1024.png',
  '/blog/2025/04/111872_iphone13-colors-480.png',
  '/blog/2025/04/iPhone14-rangeyellow-300x188-1.png',
  '/blog/2025/04/iphone_16_pro_black_1_22012457.avif',
  '/blog/2025/04/iphone_16e_black_05_568aa3391.jpg',
  '/blog/2025/04/screenshot-2023-09-12-at-10-38-30-am-1-1024x671.jpg',
  '/blog/2025/05/22.png',
  '/blog/2025/05/460388-1200-auto.jpg',
  '/blog/2025/06/Snapdragon-X-Elite-reference-laptop-23W-vs-80W-1024x900.webp',
  '/blog/2025/06/airpods-4th-gen-02-scaled.webp',
  '/blog/2025/06/airpods-4th-gen-03-scaled.webp',
  '/blog/2025/06/airpods-4th-gen-04-scaled.webp',
  '/blog/2025/06/anh-nhat-uCqMa_s-JDg-unsplash_1_905x600-1.webp',
  '/blog/2025/06/galaxy-unpacked-2025-event-confirmed.webp',
  '/blog/2025/06/tecno-camon-40-pro-5g-review-05-1024x960.webp',
  '/blog/2025/07/Apple_MacBook-Pro_14-16-inch_10182021_big.jpg.large_2x-1024x1024.avif',
]);

function getTrustedCdnOrigin(): string {
  // Match the origin the rest of the blog media helpers use
  // (blog-managed-storage-paths.ts), so configured deployments are honored —
  // not just the compile-time default. NEXT_PUBLIC_ vars are inlined for the
  // client bundle, so read process.env directly to avoid the server env module.
  const origin =
    process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN ||
    DEFAULT_BLOG_MEDIA_CDN_ORIGIN;
  return origin.replace(/\/+$/, '');
}

export function isTrustedCdnInlineImage(
  src: string | null | undefined
): src is string {
  if (!src) {
    return false;
  }
  return (
    src.startsWith(`${getTrustedCdnOrigin()}/`) &&
    INLINE_IMAGE_PATH_PATTERN.test(src)
  );
}

export function isLegacyOgabasseyCdnBlogImage(
  src: string | null | undefined
): src is string {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src);
    return (
      url.origin === OGABASSEY_LEGACY_BLOG_CDN_ORIGIN &&
      STALE_OGABASSEY_BLOG_IMAGE_PATHS.has(url.pathname)
    );
  } catch {
    return false;
  }
}

const INLINE_IMAGE_SRCSET_WIDTHS = [384, 640, 828, 1080, 1200] as const;
const INLINE_IMAGE_FALLBACK_WIDTH = 828;
const INLINE_IMAGE_QUALITY = 70;
const CDN_IMAGE_TRANSFORM_PREFIX = '/image/';
const TRANSFORMABLE_IMAGE_EXTENSION_PATTERN = /\.(?:avif|jpe?g|png|webp)$/i;
const TRANSFORM_RESERVED_KEYS = new Set([
  'width',
  'w',
  'height',
  'h',
  'quality',
  'q',
  'format',
  'f',
]);
export const BLOG_INLINE_IMAGE_SIZES =
  '(max-width: 768px) calc(100vw - 3rem), 800px';
export interface InlineImageSiblings {
  avif: string;
  webp: string;
  fallback: string;
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrcSet: string;
  sizes: string;
  width?: number;
  height?: number;
}

function parseTransformSegment(transformSegment: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of transformSegment.split(',')) {
    const equalsIndex = part.indexOf('=');
    const key = (equalsIndex >= 0 ? part.slice(0, equalsIndex) : part).trim();
    if (key) {
      params.set(
        key,
        equalsIndex >= 0 ? part.slice(equalsIndex + 1).trim() : ''
      );
    }
  }
  return params;
}

function buildTransformSegment(
  params: Map<string, string>,
  width: number
): string {
  const pinnedQuality = params.get('quality') || params.get('q');
  const quality = pinnedQuality || String(INLINE_IMAGE_QUALITY);
  const format = params.get('format') || params.get('f') || 'auto';
  const extras = Array.from(params.entries())
    .filter(([key]) => !TRANSFORM_RESERVED_KEYS.has(key))
    .map(([key, value]) => `${key}=${value}`);

  return [
    `width=${width}`,
    `quality=${quality}`,
    `format=${format}`,
    ...extras,
  ].join(',');
}

function buildTrustedCdnTransformUrl(
  src: string,
  width: number
): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  if (url.origin !== getTrustedCdnOrigin()) {
    return null;
  }

  if (!url.pathname.startsWith(CDN_IMAGE_TRANSFORM_PREFIX)) {
    if (!TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(url.pathname)) {
      return null;
    }

    return `${url.origin}${CDN_IMAGE_TRANSFORM_PREFIX}width=${width},quality=${INLINE_IMAGE_QUALITY},format=auto${url.pathname}${url.search}${url.hash}`;
  }

  const remainder = url.pathname.slice(CDN_IMAGE_TRANSFORM_PREFIX.length);
  const separatorIndex = remainder.indexOf('/');
  if (separatorIndex <= 0) {
    return null;
  }

  const transformSegment = remainder.slice(0, separatorIndex);
  const assetPath = remainder.slice(separatorIndex);
  if (!TRANSFORMABLE_IMAGE_EXTENSION_PATTERN.test(assetPath)) {
    return null;
  }

  const params = parseTransformSegment(transformSegment);
  return `${url.origin}${CDN_IMAGE_TRANSFORM_PREFIX}${buildTransformSegment(params, width)}${assetPath}${url.search}${url.hash}`;
}

function buildResponsiveUrl(src: string, width: number): string {
  const transformed = buildTrustedCdnTransformUrl(src, width);
  if (transformed) {
    return transformed;
  }

  const hashIndex = src.indexOf('#');
  const base = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}w=${width}&q=${INLINE_IMAGE_QUALITY}${hash}`;
}

function buildResponsiveSrcSet(src: string): string {
  return INLINE_IMAGE_SRCSET_WIDTHS.map(
    (width) => `${buildResponsiveUrl(src, width)} ${width}w`
  ).join(', ');
}

/**
 * Derive the pre-generated AVIF/WebP sibling URLs for a trusted CDN inline image.
 * Caller must gate on {@link isTrustedCdnInlineImage} first. Any query/hash is
 * preserved by inserting the suffix before it.
 */
export function buildInlineImageSiblings(
  src: string,
  dimensions: Partial<Pick<InlineImageSiblings, 'width' | 'height'>> = {}
): InlineImageSiblings {
  const match = src.match(/^([^?#]+)([?#].*)?$/);
  const path = match?.[1] ?? src;
  const suffix = match?.[2] ?? '';
  const avif = `${path}.avif${suffix}`;
  const webp = `${path}.webp${suffix}`;

  return {
    avif,
    webp,
    fallback: buildResponsiveUrl(src, INLINE_IMAGE_FALLBACK_WIDTH),
    avifSrcSet: buildResponsiveSrcSet(avif),
    webpSrcSet: buildResponsiveSrcSet(webp),
    fallbackSrcSet: buildResponsiveSrcSet(src),
    sizes: BLOG_INLINE_IMAGE_SIZES,
    width: dimensions.width,
    height: dimensions.height,
  };
}
