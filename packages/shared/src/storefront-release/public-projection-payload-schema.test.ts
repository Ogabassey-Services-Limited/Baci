import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const validPayload = {
  merchant: {
    name: 'Pilot Store',
    publishedStatus: 'published',
    slug: 'pilot-store',
  },
  publishedConfig: { content: [], root: { props: { title: 'Home' } } },
  products: [],
} as const;

describe('StorefrontPublicProjectionPayloadSchema', () => {
  it('accepts the bounded public storefront fields', () => {
    expect(StorefrontPublicProjectionPayloadSchema.parse(validPayload)).toEqual(
      validPayload
    );
  });

  it('preserves bounded public merchant contact and social details', () => {
    const payload = {
      ...validPayload,
      merchant: {
        ...validPayload.merchant,
        address: '1 Market Road, Lagos',
        businessHours: { monday: '09:00-17:00' },
        email: 'hello@pilot.example',
        phone: '+2348000000000',
        socialLinks: { instagram: 'https://instagram.com/pilot' },
        supportEmail: 'support@pilot.example',
        supportPhone: '+2348111111111',
      },
    } as const;

    expect(StorefrontPublicProjectionPayloadSchema.parse(payload)).toEqual(
      payload
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

  it('requires the merchant snapshot to be published', () => {
    const { publishedStatus: _publishedStatus, ...merchant } =
      validPayload.merchant;

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        merchant,
      }).success
    ).toBe(false);
  });

  it('accepts PostgreSQL timestamps with explicit offsets', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        contentPages: [
          {
            body: 'Public page',
            format: 'plain_text',
            id: '123e4567-e89b-42d3-a456-426614174010',
            publishedAt: '2026-08-25T14:00:00+01:00',
            slug: 'about',
            status: 'published',
            title: 'About',
          },
        ],
      }).success
    ).toBe(true);
  });

  it('preserves bounded variant attributes and condition', () => {
    const payload = {
      ...validPayload,
      products: [
        {
          available: true,
          currency: 'NGN',
          id: '123e4567-e89b-42d3-a456-426614174020',
          name: 'Phone',
          priceMinor: 100_000,
          slug: 'phone',
          status: 'active',
          variants: [
            {
              attributes: { color: 'Black', storage: '256 GB' },
              available: true,
              condition: 'refurbished',
              id: '123e4567-e89b-42d3-a456-426614174021',
              name: 'Black / 256 GB',
              priceMinor: 100_000,
            },
          ],
        },
      ],
    } as const;

    expect(StorefrontPublicProjectionPayloadSchema.parse(payload)).toEqual(
      payload
    );
  });

  it('rejects published configurations that require preview substitution', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        publishedConfig: {
          content: [
            {
              props: {
                code: '<script>window.compromised = true</script>',
                id: 'unsafe-code',
              },
              type: 'CodeEmbed',
            },
          ],
          root: { props: { title: 'Home' } },
        },
      }).success
    ).toBe(false);
  });

  it('requires every media reference to resolve to one unique media row', () => {
    const missingMediaId = '123e4567-e89b-42d3-a456-426614174030';

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        merchant: {
          ...validPayload.merchant,
          brandTokens: { logoMediaId: missingMediaId },
        },
      }).success
    ).toBe(false);

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        media: [
          {
            alt: 'Logo',
            id: missingMediaId,
            publicUrl: `/release-assets/${'a'.repeat(64)}.png`,
          },
          {
            alt: 'Duplicate logo',
            id: missingMediaId,
            publicUrl: `/release-assets/${'b'.repeat(64)}.png`,
          },
        ],
      }).success
    ).toBe(false);
  });

  it('accepts media references backed by unique media rows', () => {
    const logoMediaId = '123e4567-e89b-42d3-a456-426614174040';
    const payload = {
      ...validPayload,
      media: [
        {
          alt: 'Logo',
          id: logoMediaId,
          publicUrl: `/release-assets/${'a'.repeat(64)}.png`,
        },
      ],
      merchant: {
        ...validPayload.merchant,
        brandTokens: { logoMediaId },
      },
    } as const;

    expect(StorefrontPublicProjectionPayloadSchema.parse(payload)).toEqual(
      payload
    );
  });

  it('requires product and parent category references to resolve', () => {
    const categoryId = '123e4567-e89b-42d3-a456-426614174050';
    const missingCategoryId = '123e4567-e89b-42d3-a456-426614174051';
    const product = {
      available: true,
      categoryIds: [missingCategoryId],
      currency: 'NGN',
      id: '123e4567-e89b-42d3-a456-426614174052',
      name: 'Phone',
      priceMinor: 100_000,
      slug: 'phone',
      status: 'active',
    } as const;

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: categoryId,
            name: 'Phones',
            parentId: missingCategoryId,
            slug: 'phones',
            status: 'active',
          },
        ],
        products: [product],
      }).success
    ).toBe(false);

    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        categories: [
          {
            id: categoryId,
            name: 'Phones',
            slug: 'phones',
            status: 'active',
          },
        ],
        products: [{ ...product, categoryIds: [categoryId] }],
      }).success
    ).toBe(true);
  });

  it('preserves simple-product condition and product-specific ratings', () => {
    const payload = {
      ...validPayload,
      products: [
        {
          available: true,
          condition: 'used',
          currency: 'NGN',
          id: '123e4567-e89b-42d3-a456-426614174060',
          name: 'Phone',
          priceMinor: 100_000,
          compareAtPriceMinor: 125_000,
          rating: 4.5,
          ratingCount: 12,
          reviewCount: 10,
          slug: 'phone',
          status: 'active',
        },
      ],
    } as const;

    expect(StorefrontPublicProjectionPayloadSchema.parse(payload)).toEqual(
      payload
    );
  });
});
