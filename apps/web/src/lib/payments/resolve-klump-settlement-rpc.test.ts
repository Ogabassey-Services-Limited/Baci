import { describe, expect, it } from 'vitest';
import { resolveKlumpSettlementRpc } from './resolve-klump-settlement-rpc';

describe('resolveKlumpSettlementRpc', () => {
  it('routes customer-checkout GIGL orders through the GIGL retention RPC', () => {
    expect(
      resolveKlumpSettlementRpc({
        shipping_funding_source: 'customer_checkout',
        shipping_platform_retained_amount: 1500,
        shipping_provider: 'GIGL',
      })
    ).toEqual({
      hasEconomicsSnapshot: true,
      retainedShippingAmount: 1500,
      settlementRpc: 'record_merchant_settlement_gigl_v1',
      useGiglSettlementRpc: true,
    });
  });

  it('keeps non-GIGL orders on the legacy settlement RPC', () => {
    expect(
      resolveKlumpSettlementRpc({
        shipping_funding_source: null,
        shipping_platform_retained_amount: 0,
        shipping_provider: 'TOPSHIP',
      })
    ).toMatchObject({
      settlementRpc: 'record_merchant_settlement',
      useGiglSettlementRpc: false,
    });
  });
});
