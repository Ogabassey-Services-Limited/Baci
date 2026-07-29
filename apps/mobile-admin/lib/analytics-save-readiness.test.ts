import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./invalidate-store-readiness', () => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateAnalyticsSaveReadiness } from './analytics-save-readiness';

describe('invalidateAnalyticsSaveReadiness', () => {
  it('awaits merchant, analytics, and exact readiness invalidations together', async () => {
    const queryClient = new QueryClient();
    const events: string[] = [];
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
      events.push(String(filters?.queryKey?.[0]));
      return Promise.resolve();
    });

    await invalidateAnalyticsSaveReadiness(queryClient, 'merchant-1');

    expect(events).toEqual(['merchant', 'merchant-analytics-full']);
  });
});
