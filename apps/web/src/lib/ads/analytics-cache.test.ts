import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deletePattern } = vi.hoisted(() => ({
  deletePattern: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cache: { deletePattern },
}));

import { invalidateAdsAnalyticsCache } from './analytics-cache';

describe('invalidateAdsAnalyticsCache', () => {
  beforeEach(() => {
    deletePattern.mockClear();
  });

  it('evicts every date range for only the selected merchant', () => {
    invalidateAdsAnalyticsCache(' merchant-1 ');

    expect(deletePattern).toHaveBeenCalledOnce();
    expect(deletePattern).toHaveBeenCalledWith('ad-analytics:merchant-1:*');
  });

  it('does not issue a broad invalidation for an empty merchant id', () => {
    invalidateAdsAnalyticsCache('   ');

    expect(deletePattern).not.toHaveBeenCalled();
  });
});
