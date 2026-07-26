import { describe, expect, it, vi } from 'vitest';
import type { CategoryRouteContext } from './category-route-types';
import { isParentCategoryOwnedByMerchant } from './is-parent-category-owned-by-merchant';

function supabaseReturning(
  data: {
    id: string;
    is_active: boolean | null;
    parent_id: string | null;
  } | null,
  error: unknown = null
) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data, error }),
          })),
        })),
      })),
    })),
  } as unknown as CategoryRouteContext['supabase'];
}

describe('isParentCategoryOwnedByMerchant', () => {
  it.each([
    [{ id: 'parent', is_active: true, parent_id: null }, null, 'owned'],
    [{ id: 'parent', is_active: false, parent_id: null }, null, 'retired'],
    [{ id: 'parent', is_active: null, parent_id: null }, null, 'owned'],
    [{ id: 'parent', is_active: true, parent_id: 'root' }, null, 'nested'],
    [null, null, 'absent'],
    [null, { message: 'timeout' }, 'lookup-failed'],
  ] as const)('maps data %j and error %j to %s', async (data, error, expected) => {
    await expect(
      isParentCategoryOwnedByMerchant(
        supabaseReturning(data, error),
        'merchant-1',
        'parent'
      )
    ).resolves.toBe(expected);
  });
});
