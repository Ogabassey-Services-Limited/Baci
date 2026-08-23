import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const validPayload = {
  merchant: { name: 'Pilot Store', slug: 'pilot-store' },
  publishedConfig: { content: [], root: { props: { title: 'Home' } } },
  products: [],
} as const;

describe('StorefrontPublicProjectionPayloadSchema', () => {
  it('accepts the bounded public storefront fields', () => {
    expect(StorefrontPublicProjectionPayloadSchema.parse(validPayload)).toEqual(
      validPayload
    );
  });

  it('rejects customer, draft, and credential-bearing fields', () => {
    for (const privateField of [
      { customer: { email: 'shopper@example.com' } },
      { draftConfig: { content: [] } },
      { serviceRoleKey: 'secret' },
    ]) {
      expect(
        StorefrontPublicProjectionPayloadSchema.safeParse({
          ...validPayload,
          ...privateField,
        }).success
      ).toBe(false);
    }
  });

  it('rejects signed media URLs from the public projection', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        media: [
          {
            id: '123e4567-e89b-42d3-a456-426614174001',
            alt: 'Product image',
            publicUrl: 'https://cdn.example.com/image.jpg?token=secret',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects unknown nested merchant fields', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        merchant: {
          ...validPayload.merchant,
          providerCredentials: { key: 'secret' },
        },
      }).success
    ).toBe(false);
  });
});
