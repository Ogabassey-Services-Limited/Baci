import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disabled: false,
  loggerError: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock('@/lib/events/event-pipeline-config', () => ({
  isLegacyAnalyticsFanoutDisabled: () => mocks.disabled,
}));
vi.mock('@/lib/trigger-purchase-conversion', () => ({
  triggerPurchaseConversion: (...args: unknown[]) => mocks.trigger(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import { scheduleLegacyPurchaseConversion } from './schedule-legacy-purchase-conversion';

const args = {
  merchantId: 'merchant-1',
  order: { id: 'order-1', total: 100 },
  scheduleAfter: vi.fn((task: () => Promise<void>) => task()),
  supabase: {} as never,
};

describe('scheduleLegacyPurchaseConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.disabled = false;
    mocks.trigger.mockResolvedValue(undefined);
  });

  it('schedules a legacy-only fallback while migration overlap is open', async () => {
    expect(scheduleLegacyPurchaseConversion(args)).toBe(true);
    expect(args.scheduleAfter).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(mocks.trigger).toHaveBeenCalledTimes(1));
    expect(mocks.trigger).toHaveBeenCalledWith(
      args.supabase,
      'merchant-1',
      args.order,
      { deliveryMode: 'legacy_only' }
    );
  });

  it('does not schedule after the fail-closed full cutover gate closes', () => {
    mocks.disabled = true;

    expect(scheduleLegacyPurchaseConversion(args)).toBe(false);
    expect(args.scheduleAfter).not.toHaveBeenCalled();
  });

  it('logs detached fallback failures without rejecting the caller', async () => {
    mocks.trigger.mockRejectedValueOnce(new Error('legacy failed'));

    scheduleLegacyPurchaseConversion(args);
    await vi.waitFor(() => expect(mocks.loggerError).toHaveBeenCalledTimes(1));
  });
});
