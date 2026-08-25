import { describe, expect, it, vi } from 'vitest';
import { markFinalAdsSync } from './mark-final-ads-sync';

describe('markFinalAdsSync', () => {
  it('skips intermediate chunks and marks only the final chunk', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const base = {
      merchantId: 'merchant-1',
      provider: 'google_ads',
      providerCustomerId: 'customer-1',
      supabase: { rpc } as never,
    };

    await expect(
      markFinalAdsSync({ ...base, finalChunk: false })
    ).resolves.toBe(true);
    expect(rpc).not.toHaveBeenCalled();

    await expect(markFinalAdsSync(base)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'mark_merchant_ads_connection_synced_if_current',
      {
        p_merchant_id: 'merchant-1',
        p_provider: 'google_ads',
        p_provider_customer_id: 'customer-1',
      }
    );
  });
});
