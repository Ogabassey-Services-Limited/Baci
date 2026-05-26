import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('storefront ads.txt route', () => {
  it('returns plain text without invoking storefront page rendering', async () => {
    const response = GET();

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    await expect(response.text()).resolves.toContain(
      'No authorized digital sellers'
    );
  });
});
