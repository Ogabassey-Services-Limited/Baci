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
