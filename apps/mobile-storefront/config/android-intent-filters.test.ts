import { describe, expect, it } from '@jest/globals';

import { buildStorefrontAndroidIntentFilters } from './android-intent-filters';

describe('buildStorefrontAndroidIntentFilters', () => {
  it('claims only native storefront paths on each supported host', () => {
    const filters = buildStorefrontAndroidIntentFilters();
    const data = filters.flatMap((filter) => filter.data ?? []);

    expect(filters).toHaveLength(2);
    expect(filters.every((filter) => filter.action === 'VIEW')).toBe(true);
    expect(filters.every((filter) => filter.autoVerify)).toBe(true);
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          host: 'ogabassey.com',
          pathPrefix: '/product/',
        }),
        expect.objectContaining({
          host: 'ogabassey.usebaci.com',
          pathPrefix: '/category/',
        }),
        expect.objectContaining({ host: 'ogabassey.com', path: '/cart' }),
        expect.objectContaining({ host: 'ogabassey.usebaci.com', path: '/' }),
      ])
    );
    expect(data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathPrefix: '/' }),
        expect.objectContaining({ pathPrefix: '/blog/' }),
      ])
    );
  });
});
