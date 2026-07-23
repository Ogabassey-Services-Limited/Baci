import { beforeEach, describe, expect, it, vi } from 'vitest';
import { schedulePaidOrderNotifications } from '@/lib/payments/notify-paid-order';

const mocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: mocks.notifyNewOrder,
  notifyPaymentReceived: mocks.notifyPaymentReceived,
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.loggerWarn },
}));

const richOrder = {
  currency: 'NGN',
  customer_name: 'Ada',
  id: 'order-1',
  order_number: 'ORD-1',
  total: 1500,
} as never;

async function runScheduledNotifications() {
  let scheduled: (() => Promise<void>) | undefined;
  schedulePaidOrderNotifications({
    merchantId: 'merchant-1',
    richOrder,
    scheduleAfter: (task) => {
      scheduled = task;
    },
  });
  await scheduled?.();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notifyNewOrder.mockResolvedValue(undefined);
  mocks.notifyPaymentReceived.mockResolvedValue(undefined);
});

describe('schedulePaidOrderNotifications', () => {
  it('sends both merchant notifications', async () => {
    await runScheduledNotifications();

    expect(mocks.notifyNewOrder).toHaveBeenCalledWith(
      'merchant-1',
      'order-1',
      'ORD-1',
      'Ada',
      1500,
      'NGN'
    );
    expect(mocks.notifyPaymentReceived).toHaveBeenCalledWith(
      'merchant-1',
      1500,
      'NGN',
      'ORD-1',
      'order-1'
    );
  });

  it.each([
    ['new order', 'notifyNewOrder'],
    ['payment received', 'notifyPaymentReceived'],
  ] as const)('swallows and logs a rejected %s push', async (_label, method) => {
    mocks[method].mockRejectedValue(new Error('push unavailable'));

    await expect(runScheduledNotifications()).resolves.toBeUndefined();

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
