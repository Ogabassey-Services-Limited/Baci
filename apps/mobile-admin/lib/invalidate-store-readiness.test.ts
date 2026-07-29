import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./store-readiness-query', () => ({
  storeReadinessKeys: {
    detail: (merchantId: string) =>
      ['store-readiness', 'mobile', merchantId] as const,
  },
}));

import { invalidateStoreReadiness } from './invalidate-store-readiness';

describe('invalidateStoreReadiness', () => {
  it('invalidates only the active merchant readiness query', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await invalidateStoreReadiness(
      queryClient,
      '11111111-1111-4111-8111-111111111111'
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        'store-readiness',
        'mobile',
        '11111111-1111-4111-8111-111111111111',
      ],
    });
  });

  it('rejects an empty merchant id instead of invalidating every readiness query', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(invalidateStoreReadiness(queryClient, '   ')).rejects.toThrow(
      'Merchant ID is required to invalidate store readiness'
    );

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('normalizes surrounding whitespace before building the merchant query key', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await invalidateStoreReadiness(queryClient, '  merchant-123  ');

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['store-readiness', 'mobile', 'merchant-123'],
    });
  });
});
