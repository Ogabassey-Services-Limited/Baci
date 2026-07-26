import { describe, expect, it, vi } from 'vitest';
import {
  type CategoryRouteContext,
  wouldCreateCategoryCycle,
} from './category-route-support';

const MERCHANT_ID = 'merchant-1';
const CATEGORY = 'cat-self';

/** Minimal `categories` table keyed by id, answering parent_id lookups. */
function supabaseWithTree(tree: Record<string, string | null>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_idCol: string, id: string) => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: id in tree ? { parent_id: tree[id] } : null,
              error: null,
            }),
          })),
        })),
      })),
    })),
  } as unknown as CategoryRouteContext['supabase'];
}

describe('wouldCreateCategoryCycle', () => {
  it('rejects self-parenting without any query', async () => {
    const client = supabaseWithTree({});

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, CATEGORY)
    ).resolves.toBe('cycle');
  });

  it('rejects a parent that is a DESCENDANT of the category', async () => {
    const client = supabaseWithTree({
      grandchild: 'child',
      child: CATEGORY,
      [CATEGORY]: null,
    });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'grandchild')
    ).resolves.toBe('cycle');
  });

  it('accepts an unrelated parent', async () => {
    const client = supabaseWithTree({ other: null, [CATEGORY]: null });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'other')
    ).resolves.toBe('safe');
  });

  it('accepts a parent whose chain leaves this merchant', async () => {
    const client = supabaseWithTree({ other: 'unreadable' });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'other')
    ).resolves.toBe('safe');
  });

  it('fails closed when an ancestor lookup ERRORS', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        })),
      })),
    } as unknown as CategoryRouteContext['supabase'];

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'other')
    ).resolves.toBe('lookup-failed');
  });

  it('fails closed on a pre-existing loop rather than spinning forever', async () => {
    const client = supabaseWithTree({ a: 'b', b: 'a' });

    await expect(
      wouldCreateCategoryCycle(client, MERCHANT_ID, CATEGORY, 'a')
    ).resolves.toBe('cycle');
  });
});
