import {
  isAllowedBlogOgImageUrl,
  isAllowedLogoUrl,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-security';

const FEATURED_IMAGE_TIMEOUT_MS = 4000;
const LOGO_IMAGE_TIMEOUT_MS = 1200;
export const MAX_REMOTE_IMAGE_BYTES = 4 * 1024 * 1024;

const SUPPORTED_RASTER_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);

class RemoteImagePayloadTooLargeError extends Error {
  constructor() {
    super('Remote image payload exceeds the maximum allowed size');
    this.name = 'RemoteImagePayloadTooLargeError';
  }
}

export type RemoteImageLoadStatus =
  | 'loaded'
  | 'source_missing'
  | 'source_disallowed'
  | 'fetch_failed'
  | 'timed_out'
  | 'invalid_content_type'
  | 'payload_too_large';

export type RemoteImageLoadResult = {
  dataUri: string | null;
  status: RemoteImageLoadStatus;
};

const RETRYABLE_FEATURED_IMAGE_FALLBACK_STATUSES =
  new Set<RemoteImageLoadStatus>([
    'source_disallowed',
    'fetch_failed',
    'timed_out',
    'invalid_content_type',
    'payload_too_large',
  ]);

function getContentLength(headers: Headers): number | null {
  const rawContentLength = headers.get('content-length');
  if (!rawContentLength || !/^\d+$/.test(rawContentLength)) return null;

  const contentLength = Number(rawContentLength);
  return Number.isSafeInteger(contentLength) ? contentLength : null;
}

async function readBoundedResponseBody(
  response: Response
): Promise<Uint8Array> {
  const contentLength = getContentLength(response.headers);
  if (contentLength !== null && contentLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new RemoteImagePayloadTooLargeError();
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new RemoteImagePayloadTooLargeError();
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RemoteImagePayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function loadRemoteImageDataUri(
  url: string | null,
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
      cache: 'no-store',
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

    const buffer = Buffer.from(
      await readBoundedResponseBody(response)
    ).toString('base64');
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
      status:
        errorName === 'AbortError'
          ? 'timed_out'
          : errorName === 'RemoteImagePayloadTooLargeError'
            ? 'payload_too_large'
            : 'fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function loadFeaturedImage(
  url: string | null,
  merchantId: string
): Promise<RemoteImageLoadResult> {
  return loadRemoteImageDataUri(url, FEATURED_IMAGE_TIMEOUT_MS, (raw) =>
    isAllowedBlogOgImageUrl(raw, merchantId)
  );
}

export async function loadFeaturedImageWithFallback(
  urls: string[],
  merchantId: string
): Promise<RemoteImageLoadResult> {
  const [primaryUrl, fallbackUrl] = urls;
  const primaryResult = await loadFeaturedImage(primaryUrl ?? null, merchantId);

  if (
    !fallbackUrl ||
    primaryResult.status === 'loaded' ||
    !RETRYABLE_FEATURED_IMAGE_FALLBACK_STATUSES.has(primaryResult.status)
  ) {
    return primaryResult;
  }

  return loadFeaturedImage(fallbackUrl, merchantId);
}

export async function loadLogoImage(
  url: string | null
): Promise<string | null> {
  const result = await loadRemoteImageDataUri(
    url,
    LOGO_IMAGE_TIMEOUT_MS,
    isAllowedLogoUrl
  );
  return result.dataUri;
}
