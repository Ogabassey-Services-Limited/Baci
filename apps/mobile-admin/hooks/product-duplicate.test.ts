import { describe, expect, it, vi } from 'vitest';
import { isDuplicateConstraintError, toProductSlug } from './product-duplicate';

vi.mock('@baci/shared', () => ({
  normalizeProductSearchText: (value: string) => value.toLowerCase(),
}));

vi.mock('@/lib/product-search', () => ({
  fetchAdminProductSuggestionCandidates: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

describe('product duplicate helpers', () => {
  it('normalizes product names into slugs', () => {
    expect(toProductSlug('  iPhone 15 Pro Max!!! ')).toBe(
      'iphone-15-pro-max'
    );
  });

  it('detects database and text duplicate errors', () => {
    expect(isDuplicateConstraintError({ code: '23505', message: 'unique' })).toBe(
      true
    );
    expect(isDuplicateConstraintError({ message: 'duplicate key value' })).toBe(
      true
    );
    expect(isDuplicateConstraintError({ message: 'other error' })).toBe(false);
  });
});
