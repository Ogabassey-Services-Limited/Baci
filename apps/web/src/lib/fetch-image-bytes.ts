import { isPublicHttpUrl } from '@/lib/is-public-http-url';

// Fetches a remote image URL as raw bytes for AI providers that only accept
// base64 data-URI images and never download remote URLs themselves (Cerebras
// gemma-4-31b via the vision chain — see @/ai/vision-provider-chain). Never
// throws: every failure mode (network error, timeout, non-2xx, non-image
// content-type, oversize payload, invalid URL, non-http(s) scheme, or a URL
// that resolves to a private/loopback address) collapses to `null` so callers
// can fall back to a URL-based path (e.g. Gemini, which does accept remote
// image URLs directly).
//
// The caller-supplied URL is SSRF-guarded (see @/lib/is-public-http-url):
// this runs on our server for values that reach us from an anonymous,
// pre-signup server action.

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024; // Cerebras free-tier image payload cap
const DEFAULT_TIMEOUT_MS = 5_000;

export interface FetchImageBytesOptions {
  /** Maximum allowed payload size in bytes. Defaults to 4MB. */
  maxBytes?: number;
  /** Request + body-read timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
}

export interface FetchImageBytesResult {
  bytes: Uint8Array;
  /** The response's IANA media type, e.g. "image/png". */
  mediaType: string;
}

function getContentLength(headers: Headers): number | null {
  const raw = headers.get('content-length');
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

async function readBodyWithinLimit(
  response: Response,
  maxBytes: number
): Promise<Uint8Array | null> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > maxBytes ? null : bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
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

/**
 * Fetches `url` and resolves its raw bytes + media type, or `null` on ANY
 * failure. Never throws — callers should treat `null` as "fall back to
 * whatever this URL was going to be used for."
 */
export async function fetchImageBytes(
  url: string,
  options?: FetchImageBytesOptions
): Promise<FetchImageBytesResult | null> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  if (!(await isPublicHttpUrl(parsedUrl))) {
    return null;
  }

  try {
    const response = await fetch(parsedUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      // A redirect is a second, unvalidated egress — the guard above only
      // vetted the URL we were given. Refuse to follow it.
      redirect: 'error',
    });

    if (!response.ok) {
      await discardBody(response);
      return null;
    }

    const rawContentType = response.headers.get('content-type') ?? '';
    const mediaType = rawContentType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!mediaType.startsWith('image/')) {
      await discardBody(response);
      return null;
    }

    const contentLength = getContentLength(response.headers);
    if (contentLength !== null && contentLength > maxBytes) {
      await discardBody(response);
      return null;
    }

    const bytes = await readBodyWithinLimit(response, maxBytes);
    if (!bytes) {
      return null;
    }

    return { bytes, mediaType };
  } catch {
    return null;
  }
}
