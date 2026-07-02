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
    supplierAnalyticsResult: emptyResult(),
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

  it('propagates supplier analytics result failures', async () => {
    mocks.fetchMerchantAnalyticsData.mockResolvedValueOnce({
      ...createAnalyticsData(),
      supplierAnalyticsResult: {
        count: null,
        data: null,
        error: { message: 'supplier analytics failed' },
      },
    });

    await expect(
      getMerchantAnalyticsOverview(
        {} as unknown as SupabaseClient,
        'merchant-1',
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-05-07T00:00:00.000Z')
      )
    ).rejects.toThrow('supplier analytics failed');
  });

  it('maps supplier purchase analytics into the overview response', async () => {
    mocks.fetchMerchantAnalyticsData.mockResolvedValueOnce({
      ...createAnalyticsData(),
      supplierAnalyticsResult: {
        count: null,
        data: [
          {
            gross_profit: '120000',
            loss_unit_count: 0,
            missing_cost_unit_count: 1,
            order_count: 2,
            supplier_name: 'Ugosam',
            total_cost: '900000',
            total_revenue: 1_020_000,
            unit_count: 3,
          },
          {
            gross_profit: 40_000,
            loss_unit_count: 1,
            missing_cost_unit_count: 0,
            order_count: 1,
            supplier_name: 'Ovion Technology',
            total_cost: 200_000,
            total_revenue: 240_000,
            unit_count: 1,
          },
        ],
        error: null,
      },
    });

    const overview = await getMerchantAnalyticsOverview(
      {} as unknown as SupabaseClient,
      'merchant-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-07T00:00:00.000Z')
    );

    expect(overview.topSupplier).toEqual({
      grossProfit: 120_000,
      lossUnitCount: 0,
      missingCostUnitCount: 1,
      orderCount: 2,
      supplierName: 'Ugosam',
      totalCost: 900_000,
      totalRevenue: 1_020_000,
      unitCount: 3,
    });
    expect(overview.supplierAnalytics).toEqual([
      overview.topSupplier,
      {
        grossProfit: 40_000,
        lossUnitCount: 1,
        missingCostUnitCount: 0,
        orderCount: 1,
        supplierName: 'Ovion Technology',
        totalCost: 200_000,
        totalRevenue: 240_000,
        unitCount: 1,
      },
    ]);
  });
});
