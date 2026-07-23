import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueJuicywayOrderConversion } from '@/lib/payments/enqueue-juicyway-order-conversion';

const mocks = vi.hoisted(() => ({
  scheduleLegacyPurchaseConversion: vi.fn(),
  triggerPurchaseConversion: vi.fn(),
}));

vi.mock('@/lib/payments/schedule-legacy-purchase-conversion', () => ({
  scheduleLegacyPurchaseConversion: mocks.scheduleLegacyPurchaseConversion,
}));
vi.mock('@/lib/trigger-purchase-conversion', () => ({
  triggerPurchaseConversion: mocks.triggerPurchaseConversion,
}));

describe('enqueueJuicywayOrderConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.triggerPurchaseConversion.mockResolvedValue(undefined);
  });

  it('durably enqueues before scheduling legacy delivery', async () => {
    const args = {
      merchantId: 'merchant-1',
      order: { id: 'order-1' } as never,
      scheduleAfter: vi.fn(),
      supabase: {} as never,
    };

    await enqueueJuicywayOrderConversion(args);

    expect(mocks.triggerPurchaseConversion).toHaveBeenCalledWith(
      args.supabase,
      args.merchantId,
      args.order,
      { deliveryMode: 'enqueue_only' }
    );
    expect(mocks.scheduleLegacyPurchaseConversion).toHaveBeenCalledWith(args);
  });

  it('does not schedule legacy delivery when durable enqueue fails', async () => {
    mocks.triggerPurchaseConversion.mockRejectedValue(
      new Error('enqueue down')
    );

    await expect(
      enqueueJuicywayOrderConversion({
        merchantId: 'merchant-1',
        order: { id: 'order-1' } as never,
        scheduleAfter: vi.fn(),
        supabase: {} as never,
      })
    ).rejects.toThrow('enqueue down');
    expect(mocks.scheduleLegacyPurchaseConversion).not.toHaveBeenCalled();
  });
});
