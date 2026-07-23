import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StepContext } from '@/lib/payments/apply-paid-order-side-effects';
import {
  buildAdTrackingExecutor,
  toOrderForConversion,
} from '@/lib/payments/paid-order-ad-tracking-executor';
import type {
  PaidOrderSideEffectTransaction,
  RichPaidOrder,
  ServiceRoleClient,
} from '@/lib/payments/paid-order-side-effect-types';

const mocks = vi.hoisted(() => ({
  enqueueEnabled: false,
  legacyDisabled: false,
  loggerError: vi.fn(),
  triggerPurchaseConversion: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: () => mocks.enqueueEnabled,
  isLegacyAnalyticsFanoutDisabled: () => mocks.legacyDisabled,
}));

vi.mock('@/lib/trigger-purchase-conversion', () => ({
  triggerPurchaseConversion: mocks.triggerPurchaseConversion,
}));

const richOrder: RichPaidOrder = {
  ad_tracking: { fbclid: 'fb-1' },
  currency: 'NGN',
  customer_email: 'jane@example.com',
  customer_id: 'customer-1',
  customer_name: 'Jane Doe',
  customer_phone: '+2348012345678',
  discount_amount: 0,
  gift_wrapping_fee: 0,
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_items: [
    {
      id: 'item-1',
      name: 'iPhone',
      price: 20_000,
      product_id: 'product-1',
      quantity: 1,
      variant_name: null,
    },
  ],
  payment_status: 'paid',
  shipping_address: { address: '1 Baci Way', city: 'Lagos', state: 'LA' },
  shipping_fee: 0,
  subtotal: 20_000,
  tax_amount: 0,
  tax_basis: 'exclusive',
  total: 20_000,
};

const transaction: PaidOrderSideEffectTransaction = {
  amount: 20_000,
  gateway_reference: 'WALLET-DVA-ORDER-order-1',
  id: 'txn-order-1',
  merchant_id: 'merchant-1',
  order_id: 'order-1',
};

const stepContext: StepContext = {
  consistency: { consistent: true },
  gatewayResponse: {},
  order: richOrder,
  transaction,
};

describe('toOrderForConversion', () => {
  it('maps rich paid orders to conversion-safe order payloads', () => {
    expect(toOrderForConversion(richOrder)).toMatchObject({
      customer_email: 'jane@example.com',
      id: 'order-1',
      order_items: [
        {
          id: 'item-1',
          name: 'iPhone',
          price: 20_000,
          product_id: 'product-1',
          quantity: 1,
        },
      ],
      shipping_address: { city: 'Lagos', state: 'LA' },
      total: 20_000,
    });
  });

  it.each([
    null,
    undefined,
  ])('throws when the paid order payload is %s', (order) => {
    const malformedOrder: unknown = order;
    expect(() =>
      Reflect.apply(toOrderForConversion, undefined, [malformedOrder])
    ).toThrow();
  });

  it('guards missing optional customer, item, and shipping fields', () => {
    expect(
      Reflect.apply(toOrderForConversion, undefined, [
        {
          ...richOrder,
          customer_email: undefined,
          order_items: [
            { name: undefined, price: undefined, quantity: undefined },
          ],
          shipping_address: null,
        },
      ])
    ).toMatchObject({
      customer_email: null,
      order_items: [{ name: null, price: null, quantity: null }],
      shipping_address: null,
    });
  });

  it('throws when malformed line items are not array-like', () => {
    expect(() =>
      Reflect.apply(toOrderForConversion, undefined, [
        {
          ...richOrder,
          order_items: { name: 'not-an-array' },
        },
      ])
    ).toThrow();
  });
});

describe('buildAdTrackingExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueueEnabled = false;
    mocks.legacyDisabled = false;
    mocks.triggerPurchaseConversion.mockResolvedValue(undefined);
  });

  it('waits for durable enqueue before completing the side-effect step', async () => {
    mocks.enqueueEnabled = true;
    mocks.legacyDisabled = true;
    const scheduleAfter = vi.fn();

    await expect(
      buildAdTrackingExecutor({
        order: richOrder,
        scheduleAfter,
        supabase: {} as ServiceRoleClient,
        transaction,
      })(stepContext)
    ).resolves.toEqual({ legacy_scheduled: false, queued: true });

    expect(scheduleAfter).not.toHaveBeenCalled();
    expect(mocks.triggerPurchaseConversion).toHaveBeenCalledTimes(1);
    expect(mocks.triggerPurchaseConversion).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      expect.anything(),
      { deliveryMode: 'enqueue_only' }
    );
  });

  it('retains detached legacy delivery until the full cutover gate closes', async () => {
    mocks.enqueueEnabled = true;
    const scheduleAfter = vi.fn((task: () => Promise<void>) => task());

    await expect(
      buildAdTrackingExecutor({
        order: richOrder,
        scheduleAfter,
        supabase: {} as ServiceRoleClient,
        transaction,
      })(stepContext)
    ).resolves.toEqual({ legacy_scheduled: true, queued: true });

    expect(scheduleAfter).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(mocks.triggerPurchaseConversion).toHaveBeenCalledTimes(2);
    });
    expect(mocks.triggerPurchaseConversion).toHaveBeenLastCalledWith(
      expect.anything(),
      'merchant-1',
      expect.anything(),
      { deliveryMode: 'legacy_only' }
    );
  });

  it('logs a detached legacy fallback failure after durable enqueue succeeds', async () => {
    mocks.enqueueEnabled = true;
    mocks.triggerPurchaseConversion
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('legacy failed'));
    let scheduled: Promise<void> | undefined;
    const scheduleAfter = vi.fn((task: () => Promise<void>) => {
      scheduled = task();
    });

    await buildAdTrackingExecutor({
      order: richOrder,
      scheduleAfter,
      supabase: {} as ServiceRoleClient,
      transaction,
    })(stepContext);
    await scheduled;

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Legacy ad tracking failed during pipeline migration',
        orderId: 'order-1',
      })
    );
  });

  it('schedules conversion tracking after the response path', async () => {
    const supabase = {} as ServiceRoleClient;
    const scheduleAfter = vi.fn((task: () => Promise<void>) => task());

    await expect(
      buildAdTrackingExecutor({
        order: richOrder,
        scheduleAfter,
        supabase,
        transaction,
      })(stepContext)
    ).resolves.toEqual({ scheduled: true });

    expect(scheduleAfter).toHaveBeenCalledTimes(1);
    expect(mocks.triggerPurchaseConversion).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      expect.objectContaining({
        id: 'order-1',
        shipping_address: { city: 'Lagos', state: 'LA' },
      })
    );
  });

  it('logs scheduled conversion failures without rejecting the executor', async () => {
    const error = new Error('conversion failed');
    const scheduleAfter = vi.fn((task: () => Promise<void>) => task());
    mocks.triggerPurchaseConversion.mockRejectedValueOnce(error);

    await expect(
      buildAdTrackingExecutor({
        order: richOrder,
        scheduleAfter,
        supabase: {} as ServiceRoleClient,
        transaction,
      })(stepContext)
    ).resolves.toEqual({ scheduled: true });

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        message: 'Ad-tracking conversion failed (after-response path)',
        orderId: 'order-1',
      })
    );
  });
});
