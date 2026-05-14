import { describe, expect, it, vi } from 'vitest';
import { applyOrderBranchScope, getBranchScopeKey } from './branch-scope-query';

describe('branch-scope-query', () => {
  it('returns a stable cache key for all-location scope', () => {
    expect(getBranchScopeKey({ type: 'all' })).toBe('all');
  });

  it('returns the branch id as the branch cache key', () => {
    expect(
      getBranchScopeKey({
        type: 'branch',
        branchId: '123e4567-e89b-42d3-a456-426614174000',
      })
    ).toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('applies branch filters when scope is branch', () => {
    const query = {
      eq: vi.fn(),
    };
    query.eq.mockImplementation(() => query);

    expect(
      applyOrderBranchScope(query, {
        type: 'branch',
        branchId: '123e4567-e89b-42d3-a456-426614174000',
      })
    ).toBe(query);
    expect(query.eq).toHaveBeenCalledWith(
      'branch_id',
      '123e4567-e89b-42d3-a456-426614174000'
    );
  });

  it('does not apply branch filters when scope is all', () => {
    const query = {
      eq: vi.fn(),
    };
    query.eq.mockImplementation(() => query);

    expect(applyOrderBranchScope(query, { type: 'all' })).toBe(query);

    expect(query.eq).not.toHaveBeenCalled();
  });
});
