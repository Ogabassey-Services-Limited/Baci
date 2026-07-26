import { describe, expect, it, vi } from 'vitest';
import { categoryHasChildren } from './category-has-children';
import type { CategoryRouteContext } from './category-route-types';

function supabaseReturning(data: { id: string } | null, error: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data, error }),
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
});
