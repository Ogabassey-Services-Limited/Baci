import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const validPayload = {
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
} as const;

const assetUrl = `/release-assets/${'a'.repeat(64)}.png`;

describe('public projection content media ownership', () => {
  it('rejects rich-text release assets without a media declaration', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        contentPages: [
          {
            body: `![Hero](${assetUrl})`,
            format: 'sanitized_markdown',
            id: '123e4567-e89b-42d3-a456-426614174010',
            slug: 'about',
            status: 'published',
            title: 'About',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('accepts rich-text release assets declared in the media inventory', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        contentPages: [
          {
            body: `![Hero](${assetUrl})`,
            format: 'sanitized_markdown',
            id: '123e4567-e89b-42d3-a456-426614174010',
            slug: 'about',
            status: 'published',
            title: 'About',
          },
        ],
        media: [
          {
            alt: 'Hero',
            id: '123e4567-e89b-42d3-a456-426614174011',
            publicUrl: assetUrl,
          },
        ],
      }).success
    ).toBe(true);
  });
});
