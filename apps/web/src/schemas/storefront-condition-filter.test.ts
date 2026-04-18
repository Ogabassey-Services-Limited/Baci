import { describe, expect, it } from 'vitest';
import { storefrontConditionFilterSchema } from '@/schemas/storefront-condition-filter';

describe('storefrontConditionFilterSchema', () => {
  it('normalizes legacy condition aliases to canonical values', () => {
    const refurbished =
      storefrontConditionFilterSchema.safeParse('refurbished');
    const ukUsed = storefrontConditionFilterSchema.safeParse('uk_used');
    const all = storefrontConditionFilterSchema.safeParse('All');

    expect(refurbished.success).toBe(true);
    expect(ukUsed.success).toBe(true);
    expect(all.success).toBe(true);

    if (refurbished.success) {
      expect(refurbished.data).toBe('open_box');
    }

    if (ukUsed.success) {
      expect(ukUsed.data).toBe('used');
    }

    if (all.success) {
      expect(all.data).toBe('all');
    }
  });

  it('rejects unsupported conditions', () => {
    expect(
      storefrontConditionFilterSchema.safeParse('not-a-condition').success
    ).toBe(false);
  });
});
