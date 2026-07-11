import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import { recordByokFeeAccrual } from '@/lib/payments/record-byok-fee-accrual';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/zeptomail';
import {
  type PaypalCaptureOrder,
  runPaypalCaptureSideEffects,
} from './paypal-capture-side-effects';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/payments/record-byok-fee-accrual', () => ({
  recordByokFeeAccrual: vi.fn(),
}));

const rpcMock = vi.hoisted(() => vi.fn());
const singleMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: singleMock })),
      })),
    })),
    rpc: rpcMock,
  })),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({ sendEmail: vi.fn() }));

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html>'),
  generateOrderConfirmationText: vi.fn(() => 'text'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const order: PaypalCaptureOrder = {
  id: '123e4567-e89b-12d3-a456-426614174111',
  order_number: 'BACI-1002',
  customer_id: 'cust-1',
  total: 100,
  subtotal: 90,
  shipping_fee: 10,
  customer_name: 'Ada',
  customer_email: 'ada@example.com',
  customer_phone: '0800',
  shipping_address: { address: '1 St', city: 'Lagos', state: 'LA' },
  currency: 'USD',
  order_items: [
    { name: 'Widget', quantity: 1, price: 100, variant_name: null },
  ],
};

describe('runPaypalCaptureSideEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServiceClient).mockClear();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
    singleMock.mockReset();
    singleMock.mockResolvedValue({
      data: { business_name: 'Ada Store', slug: 'ada', email: 'e@x.com' },
      error: null,
    });
  });

  it('notifies, emails, and records a direct-to-merchant settlement', async () => {
    await runPaypalCaptureSideEffects({
      merchantId: 'merchant-1',
      order,
      paypalOrderId: 'PP-ORD-1',
      grossAmount: 100,
    });

    expect(notifyNewOrder).toHaveBeenCalled();
    expect(notifyPaymentReceived).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ada@example.com', emailType: 'orders' })
    );
    expect(rpcMock).toHaveBeenCalledWith(
      'record_merchant_settlement_v2',
      expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_gateway: 'paypal',
        p_gateway_reference: 'PP-ORD-1',
        p_gross_amount: 100,
        p_gateway_fee: 0,
        p_platform_fee: 0,
        p_settlement_type: 'direct_to_merchant',
      })
    );
    // F8: the fee accrual is written here (on successful capture), not at
    // create-order time, recording the full order-currency amount.
    expect(recordByokFeeAccrual).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        orderId: order.id,
        transactionReference: 'PP-ORD-1',
        provider: 'paypal',
        currency: 'USD',
        orderAmount: 100,
      })
    );
  });

  it('logs a settlement RPC error without throwing', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'settlement failed' } });

    await expect(
      runPaypalCaptureSideEffects({
        merchantId: 'merchant-1',
        order,
        paypalOrderId: 'PP-ORD-1',
        grossAmount: 100,
      })
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'PayPal capture: record_merchant_settlement_v2 returned error',
      })
    );
  });
});
