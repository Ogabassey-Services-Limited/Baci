import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PROXY_TAIL_ROWS } from './storefront-edge-proxy-tail-rows';

describe('STOREFRONT_EDGE_PROXY_TAIL_ROWS', () => {
  it('keeps closed terminal defaults after host-conditioned rows', () => {
    const ids = STOREFRONT_EDGE_PROXY_TAIL_ROWS.map(({ id }) => id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'proxy:unknown-document',
        'proxy:unsafe-document',
        'proxy:unsupported-method',
      ])
    );
    expect(ids.indexOf('proxy:unknown-document')).toBeGreaterThan(
      ids.indexOf('proxy:root-sitemap')
    );
  });
});
