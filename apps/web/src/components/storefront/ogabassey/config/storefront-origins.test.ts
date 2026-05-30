import { describe, expect, it } from 'vitest';

import { DEFAULT_MEDIA_CDN_ORIGIN } from '@/config/cdn';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OGABASSEY_CDN_ORIGIN', () => {
  it('uses the shared storefront media CDN origin', () => {
    expect(OGABASSEY_CDN_ORIGIN).toBe(DEFAULT_MEDIA_CDN_ORIGIN);
  });
});
