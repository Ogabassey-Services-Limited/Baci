import { describe, expect, it, vi } from 'vitest';
import { resolveCategoryOwnerAccess } from './resolve-category-owner-access';

function queryResult(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['eq', 'limit', 'order', 'select']) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  return query;
}

function clientWithResults(
  owner: { data: unknown; error: unknown },
  staff: { data: unknown; error: unknown }
) {
  const ownerQuery = queryResult(owner);
  const staffQuery = queryResult(staff);
  return {
    client: {
      from: vi.fn((table: string) =>
        table === 'merchants' ? ownerQuery : staffQuery
      ),
    },
    ownerQuery,
    staffQuery,
  };
}

describe('resolveCategoryOwnerAccess', () => {
  it('returns the selected owned merchant', async () => {
    const { client, ownerQuery } = clientWithResults(
      { data: { id: 'merchant-1', slug: 'merchant-one' }, error: null },
      { data: null, error: null }
    );

    await expect(
      resolveCategoryOwnerAccess(client as never, 'user-1', 'merchant-1')
    ).resolves.toEqual({
      kind: 'owner',
      canonicalMerchantSlug: 'merchant-one',
      merchantId: 'merchant-1',
    });
    expect(ownerQuery.select).toHaveBeenCalledWith('id, slug');
    expect(ownerQuery.eq).toHaveBeenCalledWith('id', 'merchant-1');
  });

  it('distinguishes active staff from an absent merchant', async () => {
    const { client } = clientWithResults(
      { data: null, error: null },
      { data: { id: 'staff-1' }, error: null }
    );

    await expect(
      resolveCategoryOwnerAccess(client as never, 'user-1')
    ).resolves.toEqual({ kind: 'staff' });
  });

  it.each([
    'owner',
    'staff',
  ])('preserves a %s lookup failure', async (stage) => {
    const { client } = clientWithResults(
      stage === 'owner'
        ? { data: null, error: { message: 'timeout' } }
        : { data: null, error: null },
      stage === 'staff'
        ? { data: null, error: { message: 'timeout' } }
        : { data: null, error: null }
    );

    await expect(
      resolveCategoryOwnerAccess(client as never, 'user-1')
    ).resolves.toEqual({ kind: 'lookup-failed' });
  });
});
