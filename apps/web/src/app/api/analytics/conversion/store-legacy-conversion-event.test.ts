import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loggerWarn: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.loggerWarn },
}));

import { storeLegacyConversionEvent } from './store-legacy-conversion-event';

describe('storeLegacyConversionEvent', () => {
  it('upserts the exact legacy analytics row and preserves idempotency', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) };
    await storeLegacyConversionEvent(
      client as unknown as Parameters<typeof storeLegacyConversionEvent>[0],
      'merchant-1',
      'purchase',
      'event-1',
      {
        custom_data: { value: 100 },
        event_name: 'PURCHASE',
        event_source: 'web',
        event_time: 1_784_937_600,
        user_data: {},
      }
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'event-1',
        event_type: 'purchase',
        merchant_id: 'merchant-1',
      }),
      {
        ignoreDuplicates: true,
        onConflict: 'merchant_id,event_id,event_type',
      }
    );
  });

  it('warns and continues when the legacy upsert fails', async () => {
    const error = new Error('analytics unavailable');
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error }),
      })),
    };
    await expect(
      storeLegacyConversionEvent(
        client as unknown as Parameters<typeof storeLegacyConversionEvent>[0],
        'merchant-1',
        'purchase',
        'event-1',
        {
          custom_data: { value: 100 },
          event_name: 'PURCHASE',
          event_source: 'web',
          event_time: 1_784_937_600,
          user_data: {},
        }
      )
    ).resolves.toBeUndefined();
    expect(mocks.loggerWarn).toHaveBeenCalledWith({
      error,
      eventType: 'purchase',
      merchantId: 'merchant-1',
      message: 'Failed to log conversion event locally',
    });
  });
});
