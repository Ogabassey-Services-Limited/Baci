import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchImageBytes } from './fetch-image-bytes';

const mockFetch = vi.fn();

function imageResponse(
  body: string,
  init?: { contentType?: string; contentLength?: string; status?: number }
) {
  const headers: Record<string, string> = {};
  if (init?.contentType !== undefined) {
    headers['content-type'] = init.contentType;
  }
  if (init?.contentLength !== undefined) {
    headers['content-length'] = init.contentLength;
  }
  return new Response(body, {
    status: init?.status ?? 200,
    headers,
  });
}

describe('fetchImageBytes', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns the decoded bytes and media type on success', async () => {
    mockFetch.mockResolvedValueOnce(
      imageResponse('logo-bytes', { contentType: 'image/png' })
    );

    const result = await fetchImageBytes('https://example.com/logo.png');

    expect(result).not.toBeNull();
    expect(result?.mediaType).toBe('image/png');
    expect(Buffer.from(result?.bytes ?? new Uint8Array()).toString()).toBe(
      'logo-bytes'
    );
  });

  it('returns null for a non-image content type', async () => {
    mockFetch.mockResolvedValueOnce(
      imageResponse('<html></html>', { contentType: 'text/html' })
    );

    const result = await fetchImageBytes('https://example.com/page.html');

    expect(result).toBeNull();
  });

  it('returns null and skips the body when the content-length header exceeds maxBytes', async () => {
    mockFetch.mockResolvedValueOnce(
      imageResponse('x'.repeat(20), {
        contentType: 'image/png',
        contentLength: String(50 * 1024 * 1024),
      })
    );

    const result = await fetchImageBytes('https://example.com/huge.png', {
      maxBytes: 4 * 1024 * 1024,
    });

    expect(result).toBeNull();
  });

  it('returns null when the streamed body exceeds maxBytes despite no content-length header', async () => {
    // No content-length header: the oversize must be caught while reading
    // the stream, not from a header short-circuit.
    mockFetch.mockResolvedValueOnce(
      imageResponse('y'.repeat(1000), { contentType: 'image/png' })
    );

    const result = await fetchImageBytes('https://example.com/streamed.png', {
      maxBytes: 10,
    });

    expect(result).toBeNull();
  });

  it('returns null when the request rejects with a network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await fetchImageBytes('https://example.com/logo.png');

    expect(result).toBeNull();
  });

  it('returns null when the request aborts due to timeout', async () => {
    mockFetch.mockRejectedValueOnce(
      new DOMException('The operation was aborted.', 'TimeoutError')
    );

    const result = await fetchImageBytes('https://example.com/slow.png', {
      timeoutMs: 5,
    });

    expect(result).toBeNull();
  });

  it('returns null for a non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(
      imageResponse('not found', { contentType: 'image/png', status: 404 })
    );

    const result = await fetchImageBytes('https://example.com/missing.png');

    expect(result).toBeNull();
  });

  it('returns null for an invalid URL string without calling fetch', async () => {
    const result = await fetchImageBytes('not-a-url');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for a non-http(s) scheme without calling fetch', async () => {
    const result = await fetchImageBytes('data:image/png;base64,aGVsbG8=');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
