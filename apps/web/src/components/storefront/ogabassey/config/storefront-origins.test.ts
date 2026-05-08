import { describe, expect, it } from 'vitest';

import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OGABASSEY_CDN_ORIGIN', () => {
  it('points to the OgaBassey CDN origin', () => {
    expect(OGABASSEY_CDN_ORIGIN).toBe('https://cdn.ogabassey.com');
  });
});
