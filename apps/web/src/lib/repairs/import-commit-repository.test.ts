import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createImportCommitRepository } from './import-commit-repository';

function asClient(from: unknown): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe('createImportCommitRepository', () => {
  it('lists devices scoped to the merchant and maps columns', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'd-1',
          brand: 'Apple',
          model: 'iPhone 12',
          slug: 'apple-iphone-12',
          aliases: ['iphone twelve', 5],
          product_id: 'p-1',
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repo = createImportCommitRepository(asClient(from), 'm-1');

    const devices = await repo.listDevices();

    expect(from).toHaveBeenCalledWith('repair_devices');
    expect(eq).toHaveBeenCalledWith('merchant_id', 'm-1');
    expect(devices[0]).toEqual({
      id: 'd-1',
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      aliases: ['iphone twelve'],
      productId: 'p-1',
    });
  });

  it('creates a device and returns its id', async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: 'd-9' }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });
    const from = vi.fn().mockReturnValue({ insert });
    const repo = createImportCommitRepository(asClient(from), 'm-1');

    const result = await repo.createDevice({
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      deviceType: 'Smartphone',
      productId: null,
      aliases: [],
    });

    expect(result.id).toBe('d-9');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ merchant_id: 'm-1', slug: 'apple-iphone-12' })
    );
  });

  it('finds a quote using is-null for a null part quality', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 'q-1' }, error: null });
    const isNull = vi.fn().mockReturnValue({ maybeSingle });
    const eq3 = vi.fn().mockReturnValue({ is: isNull });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    const repo = createImportCommitRepository(asClient(from), 'm-1');

    const found = await repo.findQuote('d-1', 's-1', null);

    expect(isNull).toHaveBeenCalledWith('part_quality', null);
    expect(found).toEqual({ id: 'q-1' });
  });

  it('throws when a list query errors', async () => {
    const eq = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'boom' } });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repo = createImportCommitRepository(asClient(from), 'm-1');

    await expect(repo.listServiceTypes()).rejects.toThrow('boom');
  });
});
