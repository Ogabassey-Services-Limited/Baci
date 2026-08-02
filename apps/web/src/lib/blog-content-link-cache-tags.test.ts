import { describe, expect, it } from 'vitest';
import { getBlogContentLinksCacheTag } from './blog-content-link-cache-tags';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

describe('getBlogContentLinksCacheTag', () => {
  it('scopes blog content links to the merchant', () => {
    expect(getBlogContentLinksCacheTag(MERCHANT_ID)).toBe(
      `blog-content-links-${MERCHANT_ID}`
    );
  });
});
