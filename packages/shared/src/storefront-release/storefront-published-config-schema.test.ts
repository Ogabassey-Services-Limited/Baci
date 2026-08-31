import { describe, expect, it } from 'vitest';
import { StorefrontPublishedConfigSchema } from './storefront-published-config-schema';

describe('StorefrontPublishedConfigSchema', () => {
  it('accepts the builder root title shape without dropping published props', () => {
    const config = {
      content: [],
      root: { props: { title: 'Home' }, title: 'Home' },
    };

    expect(StorefrontPublishedConfigSchema.parse(config)).toEqual(config);
  });

  it('rejects query-bearing media inside nested Puck component props', () => {
    const result = StorefrontPublishedConfigSchema.safeParse({
      content: [
        {
          props: {
            id: 'header-1',
            logoUrl: 'https://cdn.example.com/logo.png?token=secret',
          },
          type: 'Header',
        },
      ],
      root: { props: { title: 'Home' } },
    });

    expect(result.success).toBe(false);
  });

  it('accepts content-addressed release media in supported component props', () => {
    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [
          {
            props: {
              id: 'header-1',
              logoUrl: `/release-assets/${'a'.repeat(64)}.png`,
            },
            type: 'Header',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(true);
  });

  it('rejects query-bearing navigational component props', () => {
    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [
          {
            props: {
              id: 'header-1',
              ctaButton: {
                show: true,
                text: 'Shop',
                url: 'https://example.test/go?token=secret',
              },
            },
            type: 'Header',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });

  it('rejects query-bearing CTA links', () => {
    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [
          {
            props: {
              ctaLink: 'https://example.test/go?token=secret',
              id: 'hero-1',
              title: 'Shop now',
            },
            type: 'Hero',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });

  it('rejects private-network CTA links', () => {
    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [
          {
            props: {
              ctaLink: 'https://127.0.0.1/admin',
              id: 'hero-1',
              title: 'Shop now',
            },
            type: 'Hero',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });

  it('rejects carousels that preview validation would truncate', () => {
    const slides = Array.from({ length: 6 }, (_, index) => ({
      image: `/release-assets/${String(index).padStart(64, 'a')}.png`,
    }));

    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [
          {
            props: { id: 'carousel-1', slides },
            type: 'HeroCarousel',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });

  it('returns a validation failure for large malformed arrays without throwing', () => {
    const config = {
      content: new Array(200_000).fill(null),
      root: { props: { title: 'Home' } },
    };

    const result = StorefrontPublishedConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('returns a validation failure for many zone collections without throwing', () => {
    const zones = Object.fromEntries(
      Array.from({ length: 150_000 }, (_, index) => [`zone-${index}`, []])
    );
    const config = {
      content: [],
      root: { props: { title: 'Home' } },
      zones,
    };

    const result = StorefrontPublishedConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects mismatched duplicate root titles', () => {
    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [],
        root: { props: { title: 'Rendered' }, title: 'Stored' },
      }).success
    ).toBe(false);
  });

  it('rejects private fields preserved under the original root props', () => {
    expect(
      StorefrontPublishedConfigSchema.safeParse({
        content: [],
        root: {
          props: {
            customer: { email: 'shopper@example.com' },
            serviceRoleKey: 'secret',
            title: 'Home',
          },
        },
      }).success
    ).toBe(false);
  });

  it('rejects cyclic configurations without overflowing the call stack', () => {
    const config: Record<string, unknown> = {
      content: [],
      root: { props: { title: 'Home' } },
    };
    config.loop = config;

    const result = StorefrontPublishedConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
