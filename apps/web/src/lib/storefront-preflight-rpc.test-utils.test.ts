import { describe, expect, it } from 'vitest';
import { context } from './storefront-preflight-rpc.test-utils';

describe('storefront-preflight-rpc test-utils context builder', () => {
  it('returns a complete fail-open context by default', () => {
    expect(context()).toEqual({
      surface: 'product-slug',
      identifier: 'ogabassey.com',
      slug: 'default-slug',
    });
  });

  it('applies overrides without dropping the defaults', () => {
    const built = context({ surface: 'blog-post-status', slug: 'my-post' });

    expect(built).toEqual({
      surface: 'blog-post-status',
      identifier: 'ogabassey.com',
      slug: 'my-post',
    });
  });
});
