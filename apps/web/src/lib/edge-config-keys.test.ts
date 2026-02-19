import { describe, expect, it } from 'vitest';
import {
  getEdgeConfigDomainKey,
  getEdgeConfigSlugKey,
} from './edge-config-keys';

describe('edge-config key helpers', () => {
  it('builds a safe slug key', () => {
    expect(getEdgeConfigSlugKey('Ogabassey')).toBe('slug_ogabassey');
  });

  it('builds a safe domain key', () => {
    expect(getEdgeConfigDomainKey('ogaBassey.com')).toBe(
      'domain_ogabassey_com'
    );
  });

  it('normalizes invalid characters to underscores', () => {
    expect(getEdgeConfigSlugKey('store:name')).toBe('slug_store_name');
    expect(getEdgeConfigDomainKey('shop.test-domain.com')).toBe(
      'domain_shop_test-domain_com'
    );
  });
});
