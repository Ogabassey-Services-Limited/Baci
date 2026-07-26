import { describe, expect, it } from 'vitest';
import { CATEGORY_MANAGEMENT_RULE } from './category-management-rule';

describe('CATEGORY_MANAGEMENT_RULE', () => {
  it('keeps API authorization aligned with owner-only category RLS', () => {
    expect(CATEGORY_MANAGEMENT_RULE).toBe('owner-only');
  });
});
