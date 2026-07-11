import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  applyPaidOrderSideEffects: vi.fn(),
  buildEmailExecutor: vi.fn(() => vi.fn()),
  createServiceClient: vi.fn(),
  loggerError: vi.fn(),
  triggerPurchaseConversion: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/lib/payments/apply-paid-order-side-effects', () => ({
  applyPaidOrderSideEffects: mocks.applyPaidOrderSideEffects,
}));
vi.mock('@/lib/payments/paid-order-email-executor', () => ({
  buildEmailExecutor: mocks.buildEmailExecutor,
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/trigger-purchase-conversion', () => ({
  triggerPurchaseConversion: mocks.triggerPurchaseConversion,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

import { scheduleManualPaidOrderSideEffects } from './schedule-manual-paid-order-side-effects';

describe('scheduleManualPaidOrderSideEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      concurrentTakeoverSteps: [],
      failedSteps: [],
      ranSteps: [],
      skippedSteps: [],
    });
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            business_name: 'Store',
            cac_rc_number: null,
            email: 'merchant@example.com',
            email_sender_name: null,
            slug: 'store',
            support_email: null,
            tax_identification_number: null,
            website_url: null,
          },
          error: null,
        }),
      })),
    });
  });

  it('defers shared paid-order claims until after the response', async () => {
    scheduleManualPaidOrderSideEffects({
      actor: 'record-payment:user-1',
      amount: 500,
      merchantId: 'merchant-1',
      order: {
        id: 'order-1',
        merchant_id: 'merchant-1',
        subtotal: 500,
        total: 500,
      },
      transactionId: 'transaction-1',
    });

    expect(mocks.applyPaidOrderSideEffects).not.toHaveBeenCalled();
    const callback = mocks.after.mock.calls[0]?.[0];
    expect(callback).toBeTypeOf('function');

    await callback?.();

    expect(mocks.applyPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'record-payment:user-1',
        executors: expect.objectContaining({
          ad_tracking_conversion: expect.any(Function),
          paid_email: expect.any(Function),
        }),
        transaction: expect.objectContaining({
          id: 'transaction-1',
          order_id: 'order-1',
        }),
      })
    );
    expect(mocks.buildEmailExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantDetails: expect.objectContaining({ business_name: 'Store' }),
      })
    );

    const args = mocks.applyPaidOrderSideEffects.mock.calls[0]?.[0];
    await args?.executors.ad_tracking_conversion?.({});
    expect(mocks.triggerPurchaseConversion).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      expect.objectContaining({ id: 'order-1', total: 500 })
    );
  });

  it('logs failures from the shared paid-order runner', async () => {
    mocks.applyPaidOrderSideEffects.mockRejectedValueOnce(
      new Error('claim failed')
    );
    scheduleManualPaidOrderSideEffects({
      actor: 'record-payment:user-1',
      amount: 500,
      merchantId: 'merchant-1',
      order: { id: 'order-1', subtotal: 500, total: 500 },
      transactionId: 'transaction-1',
    });

    await mocks.after.mock.calls[0]?.[0]?.();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Manual paid-order side effects failed after response',
        orderId: 'order-1',
        transactionId: 'transaction-1',
      })
    );
  });

  it('normalizes a nullable legacy subtotal before scheduling side effects', async () => {
    scheduleManualPaidOrderSideEffects({
      actor: 'record-payment:user-1',
      amount: 500,
      merchantId: 'merchant-1',
      order: {
        id: 'order-1',
        merchant_id: 'merchant-1',
        subtotal: null,
        total: 500,
      },
      transactionId: 'transaction-1',
    });

    await mocks.after.mock.calls[0]?.[0]?.();

    expect(mocks.applyPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ subtotal: 0 }),
      })
    );
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('logs retryable failed steps returned by the shared runner', async () => {
    mocks.applyPaidOrderSideEffects.mockResolvedValueOnce({
      concurrentTakeoverSteps: [],
      failedSteps: [{ error: 'email failed', step: 'paid_email' }],
      ranSteps: [],
      skippedSteps: [],
    });
    scheduleManualPaidOrderSideEffects({
      actor: 'record-payment:user-1',
      amount: 500,
      merchantId: 'merchant-1',
      order: { id: 'order-1', subtotal: 500, total: 500 },
      transactionId: 'transaction-1',
    });

    await mocks.after.mock.calls[0]?.[0]?.();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        failedSteps: [{ error: 'email failed', step: 'paid_email' }],
        message: 'Manual paid-order side effects completed with failures',
        orderId: 'order-1',
      })
    );
  });

  it('logs service-client initialization failures', async () => {
    mocks.createServiceClient.mockImplementationOnce(() => {
      throw new Error('service client unavailable');
    });
    scheduleManualPaidOrderSideEffects({
      actor: 'record-payment:user-1',
      amount: 500,
      merchantId: 'merchant-1',
      order: { id: 'order-1', subtotal: 500, total: 500 },
      transactionId: 'transaction-1',
    });

    await mocks.after.mock.calls[0]?.[0]?.();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'service client unavailable',
        }),
        orderId: 'order-1',
      })
    );
  });
});
