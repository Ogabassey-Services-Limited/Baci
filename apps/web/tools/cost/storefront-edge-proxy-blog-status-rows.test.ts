import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PROXY_BLOG_STATUS_ROWS } from './storefront-edge-proxy-blog-status-rows';

describe('STOREFRONT_EDGE_PROXY_BLOG_STATUS_ROWS', () => {
  it('keeps blog status verdicts explicit and precedence-bound', () => {
    expect(STOREFRONT_EDGE_PROXY_BLOG_STATUS_ROWS).toHaveLength(4);
    expect(
      STOREFRONT_EDGE_PROXY_BLOG_STATUS_ROWS.every(
        ({ pathCondition }) =>
          pathCondition?.precedence === 'before_path_decision'
      )
    ).toBe(true);
  });
});
