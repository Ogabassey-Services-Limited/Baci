import { describe, expect, it, vi } from 'vitest';
import {
  getAdminMerchantHealthRows,
  sortAdminMerchantHealthRows,
} from '@/lib/admin-merchant-health';

describe('getAdminMerchantHealthRows', () => {
  it('uses the admin RPC when it is available', async () => {
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            merchant_id: 'merchant-1',
            business_name: 'Baci Store',
            email: 'owner@example.com',
            joined_at: '2026-03-20T10:00:00.000Z',
            total_gmv: 400,
            total_orders: 2,
            last_order_date: '2026-03-19',
            active_days: 2,
            health_status: 'healthy',
          },
        ],
        error: null,
      }),
    };

    const result = await getAdminMerchantHealthRows(supabase as never);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns the RPC error when the call fails', async () => {
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied',
        },
      }),
    };

    const result = await getAdminMerchantHealthRows(supabase as never);

    expect(result.data).toEqual([]);
    expect(result.error).toMatchObject({
      code: '42501',
      message: 'permission denied',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('sortAdminMerchantHealthRows', () => {
  const rows = [
    {
      active_days: 2,
      business_name: 'Low GMV',
      email: 'low@example.com',
      health_status: 'healthy' as const,
      joined_at: '2026-03-20T10:00:00.000Z',
      last_order_date: '2026-03-19',
      merchant_id: 'merchant-1',
      total_gmv: 400,
      total_orders: 2,
    },
    {
      active_days: 1,
      business_name: 'High GMV',
      email: 'high@example.com',
      health_status: 'new' as const,
      joined_at: '2026-03-22T10:00:00.000Z',
      last_order_date: null,
      merchant_id: 'merchant-2',
      total_gmv: 1200,
      total_orders: 1,
    },
  ];

  it('sorts admin merchant health rows by gmv, orders, and join date', () => {
    expect(
      sortAdminMerchantHealthRows(rows, 'gmv').map((row) => row.merchant_id)
    ).toEqual(['merchant-2', 'merchant-1']);
    expect(
      sortAdminMerchantHealthRows(rows, 'orders').map((row) => row.merchant_id)
    ).toEqual(['merchant-1', 'merchant-2']);
    expect(
      sortAdminMerchantHealthRows(rows, 'joined').map((row) => row.merchant_id)
    ).toEqual(['merchant-2', 'merchant-1']);
  });

  it('handles empty, single, equal, and malformed sort values safely', () => {
    const malformedRows = [
      { ...rows[0], joined_at: 'invalid-date', total_gmv: 'not-a-number' },
      { ...rows[1], joined_at: '', total_gmv: '1200', total_orders: 2 },
    ];

    expect(sortAdminMerchantHealthRows([], 'gmv')).toEqual([]);
    expect(sortAdminMerchantHealthRows([rows[0]], 'orders')).toEqual([rows[0]]);
    expect(
      sortAdminMerchantHealthRows(malformedRows, 'gmv')[0]?.merchant_id
    ).toBe('merchant-2');
    expect(
      sortAdminMerchantHealthRows(malformedRows, 'joined').map(
        (row) => row.merchant_id
      )
    ).toEqual(['merchant-1', 'merchant-2']);
  });
});
