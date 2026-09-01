import { describe, expect, it, vi } from 'vitest';
import type { StepContext } from '@/lib/payments/apply-paid-order-side-effects';
import { buildSettlementExecutor } from '@/lib/payments/paid-order-settlement-executor';
import type { ServiceRoleClient } from '@/lib/payments/paid-order-side-effect-types';

const transaction = {
  amount: 100_000,
  gateway_reference: 'REF',
  id: 'txn',
  merchant_id: 'm',
  order_id: 'o',
};
const context: StepContext = {
  consistency: { consistent: true },
  gatewayResponse: { fees: 0 },
  transaction,
  order: {
    discount_amount: 0,
    gift_wrapping_fee: 0,
    id: 'o',
    merchant_id: 'm',
    payment_status: 'paid',
    shipping_fee: 11_000,
    subtotal: 89_000,
    tax_amount: 0,
    tax_basis: 'exclusive',
    total: 100_000,
  },
};

function setup() {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return { rpc, supabase: { rpc } as unknown as ServiceRoleClient };
}

describe('GIGL shipping settlement retention', () => {
  it('retains customer checkout shipping exactly once and separates metadata', async () => {
    const { rpc, supabase } = setup();
    const result = await buildSettlementExecutor({
      externalGatewayReference: 'REF',
      settlementGateway: 'paystack',
      supabase,
      transaction: { ...transaction, platform_fee: 1_000 },
      orderShippingFundingSource: 'customer_checkout',
      orderShippingRetainedAmount: 11_000,
    })(context);
    expect(result).toMatchObject({
      commerce_platform_fee: 1_000,
      retained_shipping_amount: 11_000,
      platform_fee: 1_000,
    });
    expect(rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({
        p_platform_fee: 12_000,
        p_metadata: expect.objectContaining({
          commerce_platform_fee: 1_000,
          retained_shipping_amount: 11_000,
        }),
      })
    );
  });

  it.each([
    ['merchant_wallet', 0],
    ['null', 0],
  ] as const)('retains zero shipping for %s funding', async (source, retained) => {
    const { rpc, supabase } = setup();
    await buildSettlementExecutor({
      externalGatewayReference: 'REF',
      settlementGateway: 'paystack',
      supabase,
      transaction: { ...transaction, platform_fee: 1_000 },
      orderShippingFundingSource: source === 'null' ? null : source,
      orderShippingRetainedAmount: 11_000,
    })(context);
    expect(rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({
        p_platform_fee: 1_000,
        p_metadata: expect.objectContaining({
          retained_shipping_amount: retained,
        }),
      })
    );
  });

  it('fails closed when retained shipping makes fees exceed verified gross', async () => {
    const { rpc, supabase } = setup();
    await expect(
      buildSettlementExecutor({
        externalGatewayReference: 'REF',
        settlementGateway: 'paystack',
        supabase,
        transaction: { ...transaction, amount: 100, platform_fee: 90 },
        orderShippingFundingSource: 'customer_checkout',
        orderShippingRetainedAmount: 20,
      })(context)
    ).rejects.toThrow('Settlement fees exceed gross amount');
    expect(rpc).not.toHaveBeenCalled();
  });
});
