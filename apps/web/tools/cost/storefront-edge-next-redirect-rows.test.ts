import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_NEXT_REDIRECT_ROWS } from './storefront-edge-next-redirect-rows';

describe('STOREFRONT_EDGE_NEXT_REDIRECT_ROWS', () => {
  it('pins every reviewed next.config redirect as a document redirect', () => {
    expect(STOREFRONT_EDGE_NEXT_REDIRECT_ROWS).toHaveLength(27);
    expect(
      STOREFRONT_EDGE_NEXT_REDIRECT_ROWS.every(
        ({ decision, methods, reason }) =>
          decision === 'edge_redirect' &&
          reason === 'next_config_redirect' &&
          methods.join(',') === 'ANY'
      )
    ).toBe(true);
    expect(STOREFRONT_EDGE_NEXT_REDIRECT_ROWS.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['next:user-legacy', 'next:blog-wwdc'])
    );
    expect(
      STOREFRONT_EDGE_NEXT_REDIRECT_ROWS.find(({ id }) => id === 'next:macbook')
        ?.hostCondition?.hostnameIn
    ).toEqual(['ogabassey.com']);
    expect(
      STOREFRONT_EDGE_NEXT_REDIRECT_ROWS.find(
        ({ id }) => id === 'next:product-category'
      )?.hostCondition?.hostnameIn
    ).toEqual(['ogabassey.com', 'www.ogabassey.com']);
  });
});
