import {
  isAllowedBlogOgImageUrl,
  isAllowedLogoUrl,
} from './opengraph-image-security';

const OG_IMAGE_REVALIDATE_SECONDS = 3600;
const FEATURED_IMAGE_TIMEOUT_MS = 4000;
const LOGO_IMAGE_TIMEOUT_MS = 1200;

const SUPPORTED_RASTER_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type RemoteImageLoadStatus =
  | 'loaded'
  | 'source_missing'
  | 'source_disallowed'
  | 'fetch_failed'
  | 'timed_out'
  | 'invalid_content_type';

export type RemoteImageLoadResult = {
  dataUri: string | null;
  status: RemoteImageLoadStatus;
};

export async function loadRemoteImageDataUri(
  url: string | null,
  cacheTag: string,
  timeoutMs: number,
  isAllowed: (url: string) => boolean
): Promise<RemoteImageLoadResult> {
  if (!url) return { dataUri: null, status: 'source_missing' };
  if (!isAllowed(url)) return { dataUri: null, status: 'source_disallowed' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      next: { revalidate: OG_IMAGE_REVALIDATE_SECONDS, tags: [cacheTag] },
    });

    if (!response.ok) {
      return { dataUri: null, status: 'fetch_failed' };
    }

    const rawContentType = response.headers.get('content-type');
    if (!rawContentType) {
      return { dataUri: null, status: 'invalid_content_type' };
    }

    const contentType = rawContentType.split(';')[0]?.trim().toLowerCase();
    if (!contentType || !SUPPORTED_RASTER_CONTENT_TYPES.has(contentType)) {
      return { dataUri: null, status: 'invalid_content_type' };
    }

    const buffer = Buffer.from(await response.arrayBuffer()).toString('base64');
    return {
      dataUri: `data:${contentType};base64,${buffer}`,
      status: 'loaded',
    };
  } catch (error) {
    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String(error.name)
        : '';
    return {
      dataUri: null,
      status: errorName === 'AbortError' ? 'timed_out' : 'fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function loadFeaturedImage(
  url: string | null,
  merchantId: string,
  cacheTag: string
): Promise<RemoteImageLoadResult> {
  return loadRemoteImageDataUri(
    url,
    cacheTag,
    FEATURED_IMAGE_TIMEOUT_MS,
    (raw) => isAllowedBlogOgImageUrl(raw, merchantId)
  );
}

export async function loadLogoImage(
  url: string | null,
  cacheTag: string
): Promise<string | null> {
  const result = await loadRemoteImageDataUri(
    url,
    cacheTag,
    LOGO_IMAGE_TIMEOUT_MS,
    isAllowedLogoUrl
  );
  return result.dataUri;
}
