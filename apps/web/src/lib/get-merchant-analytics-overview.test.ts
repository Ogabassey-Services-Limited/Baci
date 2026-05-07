import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchMerchantAnalyticsData: vi.fn(),
}));

vi.mock('@/lib/merchant-analytics-queries', () => ({
  fetchMerchantAnalyticsData: mocks.fetchMerchantAnalyticsData,
}));

import { getMerchantAnalyticsOverview } from '@/lib/get-merchant-analytics-overview';
import { fetchMerchantAnalyticsData } from '@/lib/merchant-analytics-queries';
import { getComparisonAnalyticsRange } from '@/lib/merchant-analytics-range';

function emptyResult() {
  return { count: 0, data: [], error: null };
}

function createAnalyticsData() {
  return {
    activeOrdersResult: emptyResult(),
    blogPostsResult: emptyResult(),
    currentOrderItemsResult: emptyResult(),
    currentOrdersResult: emptyResult(),
    previousOrderItemsResult: emptyResult(),
    previousOrdersResult: emptyResult(),
    recentOrdersResult: emptyResult(),
  };
}

describe('getMerchantAnalyticsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchMerchantAnalyticsData.mockResolvedValue(createAnalyticsData());
  });

  it('forwards branch id to the analytics query loader', async () => {
    const supabase = {} as unknown as SupabaseClient;
    const startDate = new Date('2026-05-01T00:00:00.000Z');
    const endDate = new Date('2026-05-07T00:00:00.000Z');
    const { previousEnd, previousStart } = getComparisonAnalyticsRange(
      startDate,
      endDate
    );

    await getMerchantAnalyticsOverview(
      supabase,
      'merchant-1',
      startDate,
      endDate,
      'branch-1'
    );

    expect(fetchMerchantAnalyticsData).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      startDate,
      endDate,
      previousStart,
      previousEnd,
      'branch-1'
    );
  });

  it('forwards undefined branch id when analytics are not branch-scoped', async () => {
    const supabase = {} as unknown as SupabaseClient;
    const startDate = new Date('2026-05-01T00:00:00.000Z');
    const endDate = new Date('2026-05-07T00:00:00.000Z');
    const { previousEnd, previousStart } = getComparisonAnalyticsRange(
      startDate,
      endDate
    );

    await getMerchantAnalyticsOverview(
      supabase,
      'merchant-1',
      startDate,
      endDate
    );

    expect(fetchMerchantAnalyticsData).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      startDate,
      endDate,
      previousStart,
      previousEnd,
      undefined
    );
  });

  it('propagates analytics query loader failures', async () => {
    mocks.fetchMerchantAnalyticsData.mockRejectedValueOnce(
      new Error('query failed')
    );

    await expect(
      getMerchantAnalyticsOverview(
        {} as unknown as SupabaseClient,
        'merchant-1',
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-05-07T00:00:00.000Z')
      )
    ).rejects.toThrow('query failed');
  });
});
