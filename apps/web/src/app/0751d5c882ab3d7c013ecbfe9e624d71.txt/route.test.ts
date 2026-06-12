import { describe, expect, it } from 'vitest';
import { DEFAULT_INDEXNOW_KEY } from '@/lib/indexnow';
import { GET, HEAD } from './route';

describe('GET /0751d5c882ab3d7c013ecbfe9e624d71.txt', () => {
  it('returns the IndexNow key as plain text', async () => {
    const response = GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=86400, immutable'
    );
    expect(body).toBe(DEFAULT_INDEXNOW_KEY);
  });

  it('supports HEAD requests with the same headers', () => {
    const response = HEAD();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
  });
});
