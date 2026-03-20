import { describe, expect, it, vi } from 'vitest';
import { getAdminMerchantHealthRows } from '@/lib/admin-merchant-health';

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

  it('falls back to direct queries when the RPC has not been deployed yet', async () => {
    const merchantHealthQuery = {
      select: vi.fn().mockResolvedValue({
        data: [
          {
            merchant_id: 'merchant-1',
            business_name: 'Baci Store',
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
    const merchantsQuery = {
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'merchant-1', email: 'owner@example.com' }],
        error: null,
      }),
      select: vi.fn(() => merchantsQuery),
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchant_health') {
          return merchantHealthQuery;
        }

        if (table === 'merchants') {
          return merchantsQuery;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'PGRST202',
          message:
            'Could not find the function public.get_admin_merchant_health',
        },
      }),
    };

    const result = await getAdminMerchantHealthRows(supabase as never);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
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
    ]);
    expect(supabase.from).toHaveBeenCalledWith('merchant_health');
    expect(supabase.from).toHaveBeenCalledWith('merchants');
  });

  it('returns the RPC error when the failure is unrelated to a missing function', async () => {
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

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: '42501',
      message: 'permission denied',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
