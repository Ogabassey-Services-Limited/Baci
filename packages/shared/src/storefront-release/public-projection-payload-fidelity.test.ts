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

describe('StorefrontPublicProjectionPayloadSchema fidelity', () => {
  it('requires blog enablement whenever published posts are projected', () => {
    const blogPost = {
      authorName: 'Editor',
      content: 'Published guide',
      featuredImageUrl: null,
      id: '123e4567-e89b-42d3-a456-426614174151',
      publishedAt: '2026-08-25T14:00:00+01:00',
      slug: 'enabled-guide',
      status: 'published',
      title: 'Enabled guide',
    } as const;
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        blogPosts: [blogPost],
        featureFlags: [{ enabled: false, key: 'blog_enabled' }],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        blogPosts: [blogPost],
        featureFlags: [{ enabled: true, key: 'blog_enabled' }],
      }).success
    ).toBe(true);
  });

  it('preserves category SEO fields required by released category pages', () => {
    const category = {
      id: '123e4567-e89b-42d3-a456-426614174170',
      name: 'Phones',
      seoDescription: 'Shop reliable phones.',
      seoFaq: [{ answer: 'Yes.', question: 'Do you deliver?' }],
      seoFeatures: ['Warranty included'],
      seoHeading: 'Phones in Nigeria',
      slug: 'phones',
      status: 'active',
    } as const;
    expect(
      StorefrontPublicProjectionPayloadSchema.parse({
        ...validPayload,
        categories: [category],
      }).categories?.[0]
    ).toEqual(category);
  });

  it('preserves route-matched About and FAQ structured content', () => {
    const pages = [
      {
        body: 'About us',
        format: 'plain_text',
        id: '123e4567-e89b-42d3-a456-426614174171',
        slug: 'about',
        status: 'published',
        structuredContent: { kind: 'about', mission: 'Make commerce easy.' },
        title: 'About',
      },
      {
        body: 'Questions',
        format: 'plain_text',
        id: '123e4567-e89b-42d3-a456-426614174172',
        slug: 'faq',
        status: 'published',
        structuredContent: {
          items: [{ answer: 'Today.', question: 'When?' }],
          kind: 'faq',
        },
        title: 'FAQ',
      },
    ] as const;
    expect(
      StorefrontPublicProjectionPayloadSchema.parse({
        ...validPayload,
        contentPages: pages,
      }).contentPages
    ).toEqual(pages);
  });

  it('rejects products whose currency differs from the merchant currency', () => {
    expect(
      StorefrontPublicProjectionPayloadSchema.safeParse({
        ...validPayload,
        products: [
          {
            available: true,
            currency: 'USD',
            displayQuantityLimit: null,
            id: '123e4567-e89b-42d3-a456-426614174173',
            name: 'Dollar phone',
            priceMinor: 100,
            slug: 'dollar-phone',
            status: 'active',
          },
        ],
      }).success
    ).toBe(false);
  });
});
