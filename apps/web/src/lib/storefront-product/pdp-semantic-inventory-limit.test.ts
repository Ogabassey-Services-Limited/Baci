import { describe, expect, it } from 'vitest';
import { PDP_SEMANTIC_INVENTORY_LIMIT } from '@/lib/storefront-product/pdp-semantic-inventory-limit';

describe('PDP_SEMANTIC_INVENTORY_LIMIT', () => {
  it('keeps PDP enrichment and compare-route maintenance on the same bounded window', () => {
    expect(PDP_SEMANTIC_INVENTORY_LIMIT).toBe(48);
  });
});
