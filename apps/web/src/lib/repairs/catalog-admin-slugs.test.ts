import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadTakenSlugs } from './catalog-admin-slugs';

function clientReturning(data: unknown, error: unknown = null) {
  const like = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ like });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as SupabaseClient;
  return { client, from, select, eq, like };
}

describe('loadTakenSlugs', () => {
  it('returns a set of existing slugs scoped to the merchant', async () => {
    const { client, from, eq, like } = clientReturning([
      { slug: 'apple-iphone-12' },
      { slug: 'apple-iphone-12-2' },
    ]);

    const taken = await loadTakenSlugs(
      client,
      'repair_devices',
      'm-1',
      'apple-iphone-12'
    );

    expect(from).toHaveBeenCalledWith('repair_devices');
    expect(eq).toHaveBeenCalledWith('merchant_id', 'm-1');
    expect(like).toHaveBeenCalledWith('slug', 'apple-iphone-12%');
    expect(taken.has('apple-iphone-12')).toBe(true);
    expect(taken.has('apple-iphone-12-2')).toBe(true);
  });

  it('throws when the query errors', async () => {
    const { client } = clientReturning(null, { message: 'boom' });
    await expect(
      loadTakenSlugs(client, 'repair_service_types', 'm-1', 'screen')
    ).rejects.toThrow();
  });

  it('returns an empty set when no rows exist', async () => {
    const { client } = clientReturning([]);
    const taken = await loadTakenSlugs(
      client,
      'repair_service_types',
      'm-1',
      'screen'
    );
    expect(taken.size).toBe(0);
  });
});
