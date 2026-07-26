import { describe, expect, it, vi } from 'vitest';
import { getCategoryChildSlugs } from './get-category-child-slugs';

function clientReturning(result: { data: unknown; error: unknown }) {
  const eqParent = vi.fn().mockResolvedValue(result);
  const eqMerchant = vi.fn(() => ({ eq: eqParent }));
  const select = vi.fn(() => ({ eq: eqMerchant }));
  return {
    client: { from: vi.fn(() => ({ select })) },
    eqMerchant,
    eqParent,
  };
}

describe('getCategoryChildSlugs', () => {
  it('returns merchant-scoped child slugs for cache invalidation', async () => {
    const { client, eqMerchant, eqParent } = clientReturning({
      data: [{ slug: 'android' }, { slug: 'ios' }],
      error: null,
    });

    await expect(
      getCategoryChildSlugs(client as never, 'merchant-1', 'parent-1')
    ).resolves.toEqual({ ok: true, slugs: ['android', 'ios'] });
    expect(eqMerchant).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(eqParent).toHaveBeenCalledWith('parent_id', 'parent-1');
  });

  it('preserves a lookup failure so retirement does not skip child tags', async () => {
    const { client } = clientReturning({
      data: null,
      error: { message: 'timeout' },
    });

    await expect(
      getCategoryChildSlugs(client as never, 'merchant-1', 'parent-1')
    ).resolves.toEqual({ ok: false });
  });
});
