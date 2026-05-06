import { describe, expect, it } from 'vitest';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';

describe('PRODUCT_KEY_SPECS_RELATION_SELECT', () => {
  it('starts the relation block with the product_key_specs table name', () => {
    expect(PRODUCT_KEY_SPECS_RELATION_SELECT.trim()).toMatch(
      /^product_key_specs\s*\(/
    );
  });

  it('is wrapped in a single set of parentheses with no trailing tokens', () => {
    const trimmed = PRODUCT_KEY_SPECS_RELATION_SELECT.trim();
    expect(trimmed.endsWith(')')).toBe(true);
    const opens = (trimmed.match(/\(/g) ?? []).length;
    const closes = (trimmed.match(/\)/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(opens).toBe(1);
  });

  it('lists every spec column on its own comma-separated line and stays unique', () => {
    const match = PRODUCT_KEY_SPECS_RELATION_SELECT.trim().match(
      /^product_key_specs\s*\(([\s\S]*)\)$/
    );
    expect(match).not.toBeNull();
    const inside = match?.[1] ?? '';
    const columns = inside
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    expect(columns.length).toBeGreaterThan(0);
    for (const c of columns) {
      expect(c).toMatch(/^[a-z][a-z0-9_]*$/);
    }
    expect(new Set(columns).size).toBe(columns.length);
  });
});
