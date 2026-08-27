import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const payload = {
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
  products: [],
  publishedConfig: { content: [], root: { props: { title: 'Home' } } },
} as const;

describe('public projection policy source consistency', () => {
  it('accepts matching policy and content-page sources', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...payload,
        contentPages: [
          {
            body: 'Same privacy policy',
            format: 'plain_text',
            id: '123e4567-e89b-42d3-a456-426614174001',
            slug: 'privacy',
            status: 'published',
            title: 'Privacy',
          },
        ],
        policies: { privacy: 'Same privacy policy' },
      }).success
    ).toBe(true);
  });

  it('rejects conflicting policy and content-page sources', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...payload,
        contentPages: [
          {
            body: 'Different privacy policy',
            format: 'plain_text',
            id: '123e4567-e89b-42d3-a456-426614174001',
            slug: 'privacy-policy',
            status: 'published',
            title: 'Privacy',
          },
        ],
        policies: { privacy: 'Canonical privacy policy' },
      }).success
    ).toBe(false);
  });
});
