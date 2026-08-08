import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_PROXY_HOST_ROWS } from './storefront-edge-proxy-host-rows';

describe('STOREFRONT_EDGE_PROXY_HOST_ROWS', () => {
  it('keeps host-conditioned classes ahead of path resolution', () => {
    expect(
      STOREFRONT_EDGE_PROXY_HOST_ROWS.every(
        (row) => row.hostCondition?.precedence === 'before_path_decision'
      )
    ).toBe(true);
    expect(
      STOREFRONT_EDGE_PROXY_HOST_ROWS.find(
        ({ id }) => id === 'proxy:custom-domain-platform-route'
      )?.decision
    ).toBe('origin_dynamic');
  });
});
