import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('storefront blog ads.txt route', () => {
  it('shares the storefront ads.txt text response', async () => {
    const response = GET();

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    await expect(response.text()).resolves.toContain(
      'No authorized digital sellers'
    );
  });
});
