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

  it('returns a validation failure for large malformed arrays without throwing', () => {
    const config = {
      content: new Array(200_000).fill(null),
      root: { props: { title: 'Home' } },
    };

    expect(() =>
      StorefrontPublishedConfigSchema.safeParse(config)
    ).not.toThrow();
    expect(StorefrontPublishedConfigSchema.safeParse(config).success).toBe(
      false
    );
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
});
