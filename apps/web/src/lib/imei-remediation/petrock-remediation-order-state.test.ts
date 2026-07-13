import { describe, expect, it, vi } from 'vitest';
import { createPetrockRemediationOrderState } from './petrock-remediation-order-state';

describe('createPetrockRemediationOrderState', () => {
  it('prepares an operator-approved quote through the atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'order-1', status: 'payment_pending' }],
      error: null,
    });
    const state = createPetrockRemediationOrderState({
      customerId: 'customer-1',
      fxRate: 1575,
      merchantId: 'merchant-1',
      supabaseAdmin: { rpc } as never,
    });

    await state.prepare({
      orderId: 'order-1',
      paymentCurrency: 'USDT',
      productId: 'product-1',
    });

    expect(rpc).toHaveBeenCalledWith('prepare_petrock_remediation_order', {
      p_customer_id: 'customer-1',
      p_fx_rate: 1575,
      p_merchant_id: 'merchant-1',
      p_order_id: 'order-1',
      p_payment_currency: 'USDT',
      p_product_id: 'product-1',
    });
  });

  it('uses the force-refund RPC for failures before provider acceptance', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const state = createPetrockRemediationOrderState({
      customerId: 'customer-1',
      fxRate: 1575,
      merchantId: 'merchant-1',
      supabaseAdmin: { rpc } as never,
    });

    await state.failBeforeAcceptance({
      customerMessage: 'Refunded',
      orderId: 'order-1',
      reason: 'preflight_failed',
    });

    expect(rpc).toHaveBeenCalledWith(
      'fail_petrock_remediation_before_acceptance',
      {
        p_customer_message: 'Refunded',
        p_order_id: 'order-1',
        p_reason: 'preflight_failed',
      }
    );
  });
});
