import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvalidateStoreReadiness = vi.hoisted(() => vi.fn());
vi.mock('./invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mockInvalidateStoreReadiness,
}));

import { invalidateAnalyticsSaveReadiness } from './analytics-save-readiness';

describe('invalidateAnalyticsSaveReadiness', () => {
  beforeEach(() => {
    mockInvalidateStoreReadiness.mockReset();
    mockInvalidateStoreReadiness.mockResolvedValue(undefined);
  });

  it('awaits merchant, analytics, and exact readiness invalidations together', async () => {
    const queryClient = new QueryClient();
    const events: string[] = [];
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => releases.push(resolve));
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
      events.push(String(filters?.queryKey?.[0]));
      return deferred();
    });
    mockInvalidateStoreReadiness.mockImplementation(deferred);

    let completed = false;
    const invalidation = invalidateAnalyticsSaveReadiness(
      queryClient,
      'merchant-1',
      'user-1'
    ).then(() => {
      completed = true;
    });

    expect(events).toEqual(['merchant', 'merchant-analytics-full']);
    expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
      queryClient,
      'merchant-1'
    );
    expect(releases).toHaveLength(3);
    expect(completed).toBe(false);
    for (const release of releases) release();
    await invalidation;

    expect(events).toEqual(['merchant', 'merchant-analytics-full']);
    expect(completed).toBe(true);
  });

  it('keeps analytics saves successful when readiness invalidation fails', async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    mockInvalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );

    await expect(
      invalidateAnalyticsSaveReadiness(queryClient, 'merchant-1', 'user-1')
    ).resolves.toBeUndefined();
  });

  it('keeps analytics saves successful when merchant cache invalidation fails', async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, 'invalidateQueries')
      .mockRejectedValueOnce(new Error('Merchant refresh failed'))
      .mockRejectedValueOnce(new Error('Analytics refresh failed'));

    await expect(
      invalidateAnalyticsSaveReadiness(queryClient, 'merchant-1', 'user-1')
    ).resolves.toBeUndefined();
    expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
      queryClient,
      'merchant-1'
    );
  });
});
