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

  it('supports empty and whitespace-only input', () => {
    expect(getEdgeConfigSlugKey('')).toBe('slug_');
    expect(getEdgeConfigDomainKey('')).toBe('domain_');
    expect(getEdgeConfigSlugKey('   ')).toBe('slug_');
    expect(getEdgeConfigDomainKey('   ')).toBe('domain_');
  });

  it('preserves dashes in normalized keys', () => {
    expect(getEdgeConfigSlugKey('shop-test')).toBe('slug_shop-test');
    expect(getEdgeConfigDomainKey('shop-test.com')).toBe(
      'domain_shop-test_com'
    );
  });
});
