import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const mockInvalidateStoreReadiness = vi.hoisted(() => vi.fn());
vi.mock('./invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mockInvalidateStoreReadiness,
}));

import { invalidateAnalyticsSaveReadiness } from './analytics-save-readiness';

describe('invalidateAnalyticsSaveReadiness', () => {
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
      'merchant-1'
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

  it('propagates readiness invalidation failures', async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const failure = new Error('Readiness refresh failed');
    mockInvalidateStoreReadiness.mockRejectedValueOnce(failure);

    await expect(
      invalidateAnalyticsSaveReadiness(queryClient, 'merchant-1')
    ).rejects.toBe(failure);
  });
});
