import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionSchema } from './index';

describe('storefront-release index exports', () => {
  it('exports the public projection schema', () => {
    const result = StorefrontPublicProjectionSchema.safeParse({
      componentContractVersion: 'builder-components-v1',
      merchantId: '123e4567-e89b-42d3-a456-426614174000',
      payload: {
        merchant: {
          country: 'NG',
          currency: 'NGN',
          hostname: 'pilot-store.usebaci.com',
          id: '123e4567-e89b-42d3-a456-426614174000',
          locale: 'en-NG',
          name: 'Pilot Store',
          publishedStatus: 'published',
          slug: 'pilot-store',
          template: { contractVersion: 'v1', id: 'ogabassey' },
        },
        publishedConfig: { content: [], root: { props: { title: 'Home' } } },
        products: [],
      },
      publicationGeneration: '1',
      schemaVersion: 1,
    });

    expect(result.success).toBe(true);
  });
});
