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
