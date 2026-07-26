import { describe, expect, it, vi } from 'vitest';
import type { CategoryRouteContext } from './category-route-types';
import { wouldCreateCategoryCycle } from './would-create-category-cycle';

function supabaseWithTree(tree: Record<string, string | null>, fails = false) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, id: string) => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: id in tree ? { parent_id: tree[id] } : null,
              error: fails ? { message: 'timeout' } : null,
            }),
          })),
        })),
      })),
    })),
  } as unknown as CategoryRouteContext['supabase'];
}

describe('wouldCreateCategoryCycle', () => {
  it('rejects self-parenting', async () => {
    await expect(
      wouldCreateCategoryCycle(supabaseWithTree({}), 'merchant', 'cat', 'cat')
    ).resolves.toBe('cycle');
  });

  it('rejects a descendant parent and pre-existing loops', async () => {
    await expect(
      wouldCreateCategoryCycle(
        supabaseWithTree({ child: 'cat' }),
        'merchant',
        'cat',
        'child'
      )
    ).resolves.toBe('cycle');
    await expect(
      wouldCreateCategoryCycle(
        supabaseWithTree({ a: 'b', b: 'a' }),
        'merchant',
        'cat',
        'a'
      )
    ).resolves.toBe('cycle');
  });

  it('accepts an unrelated or missing ancestor chain', async () => {
    await expect(
      wouldCreateCategoryCycle(
        supabaseWithTree({ parent: null }),
        'merchant',
        'cat',
        'parent'
      )
    ).resolves.toBe('safe');
  });

  it('accepts a 32-ancestor chain when the final ancestor is the root', async () => {
    const ancestorIds = Array.from({ length: 32 }, (_, index) => `a-${index}`);
    const tree = Object.fromEntries(
      ancestorIds.map((id, index) => [id, ancestorIds[index + 1] ?? null])
    );

    await expect(
      wouldCreateCategoryCycle(
        supabaseWithTree(tree),
        'merchant',
        'cat',
        ancestorIds[0]
      )
    ).resolves.toBe('safe');
  });

  it('fails closed when an ancestor lookup errors', async () => {
    await expect(
      wouldCreateCategoryCycle(
        supabaseWithTree({}, true),
        'merchant',
        'cat',
        'parent'
      )
    ).resolves.toBe('lookup-failed');
  });
});
