import { describe, expect, it, vi } from 'vitest';
import type { StepContext } from '@/lib/payments/apply-paid-order-side-effects';
import { buildSettlementExecutor } from '@/lib/payments/paid-order-settlement-executor';
import type {
  PaidOrderSideEffectTransaction,
  ServiceRoleClient,
} from '@/lib/payments/paid-order-side-effect-types';

const transaction: PaidOrderSideEffectTransaction = {
  amount: 20_000,
  gateway_reference: 'BAC-JUICY',
  id: 'txn-order-1',
  merchant_id: 'merchant-1',
  order_id: 'order-1',
};

const stepContext: StepContext = {
  consistency: { consistent: true },
  gatewayResponse: { status: 'succeeded' },
  order: {
    discount_amount: 0,
    gift_wrapping_fee: 0,
    id: 'order-1',
    merchant_id: 'merchant-1',
    payment_status: 'paid',
    shipping_fee: 0,
    subtotal: 20_000,
    tax_amount: 0,
    tax_basis: 'exclusive',
    total: 20_000,
  },
  transaction,
};

function createSupabase() {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return {
    rpc,
    supabase: { rpc } as unknown as ServiceRoleClient,
  };
}

describe('buildSettlementExecutor for Juicyway', () => {
  it('records zero gateway fee and the webhook platform-fee fallback', async () => {
    const { rpc, supabase } = createSupabase();
    const result = await buildSettlementExecutor({
      allocatedGatewayFeeNgn: 250,
      externalGatewayReference: 'BAC-JUICY',
      settlementGateway: 'juicyway',
      supabase,
      transaction: { ...transaction, platform_fee: null },
    })(stepContext);

    expect(result).toEqual({
      gateway_fee: 0,
      gross_amount: 20_000,
      platform_fee: 300,
    });
    expect(rpc).toHaveBeenCalledWith('record_merchant_settlement', {
      p_description: 'Order payment via juicyway',
      p_gateway: 'juicyway',
      p_gateway_fee: 0,
      p_gateway_reference: 'BAC-JUICY',
      p_gross_amount: 20_000,
      p_merchant_id: 'merchant-1',
      p_metadata: {
        juicyway_reference: 'BAC-JUICY',
        verified_gateway_fee: 0,
      },
      p_platform_fee: 300,
      p_source_id: 'order-1',
      p_source_type: 'order',
    });
  });

  it('uses the same kobo-normalized fallback as the webhook path', async () => {
    const { rpc, supabase } = createSupabase();
    const result = await buildSettlementExecutor({
      externalGatewayReference: 'BAC-JUICY-PRECISION',
      settlementGateway: 'juicyway',
      supabase,
      transaction: { ...transaction, amount: 100.01, platform_fee: null },
    })(stepContext);

    expect(result).toMatchObject({
      gross_amount: 100.01,
      platform_fee: 1.5,
    });
    expect(rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({ p_platform_fee: 1.5 })
    );
  });
});
