import { describe, expect, it, vi } from 'vitest';
import { categoryHasChildren } from './category-has-children';
import type { CategoryRouteContext } from './category-route-types';

function supabaseReturning(data: { id: string } | null, error: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data, error }),
              })),
            })),
          })),
        })),
      })),
    })),
  } as unknown as CategoryRouteContext['supabase'];
}

describe('categoryHasChildren', () => {
  it.each([
    [{ id: 'child' }, null, 'has-children'],
    [null, null, 'no-children'],
    [null, { message: 'timeout' }, 'lookup-failed'],
  ] as const)('maps data %j and error %j to %s', async (data, error, expected) => {
    await expect(
      categoryHasChildren(supabaseReturning(data, error), 'merchant', 'parent')
    ).resolves.toBe(expected);
  });

  it('ignores explicitly retired children when deciding whether a root can move', async () => {
    // The query result models Supabase after applying the explicit-false filter:
    // a retired-only child set produces no row.
    const supabase = supabaseReturning(null) as unknown as {
      from: ReturnType<typeof vi.fn>;
    };

    await expect(
      categoryHasChildren(
        supabase as unknown as CategoryRouteContext['supabase'],
        'merchant',
        'parent'
      )
    ).resolves.toBe('no-children');

    const query = supabase.from.mock.results[0]?.value;
    const afterSelect = query.select.mock.results[0]?.value;
    const afterMerchant = afterSelect.eq.mock.results[0]?.value;
    const afterParent = afterMerchant.eq.mock.results[0]?.value;
    expect(afterParent.not).toHaveBeenCalledWith('is_active', 'is', false);
  });
});
