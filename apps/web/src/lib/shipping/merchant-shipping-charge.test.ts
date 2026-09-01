import { describe, expect, it, vi } from 'vitest';
import { reserveMerchantShippingCharge } from './merchant-shipping-charge';

describe('merchant shipping charge RPC adapter', () => {
  it('generates a 64-character token and normalizes RPC rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          charge_id: 'c1',
          charged_amount: 1200,
          balance_after: 800,
          status: 'reserved',
        },
      ],
      error: null,
    });
    const result = await reserveMerchantShippingCharge(
      { rpc } as never,
      'o1',
      'q1'
    );
    expect(rpc).toHaveBeenCalledWith(
      'reserve_merchant_shipping_charge',
      expect.objectContaining({ p_order_id: 'o1', p_quote_id: 'q1' })
    );
    expect(result.charge).toEqual({
      chargeId: 'c1',
      chargedAmount: 1200,
      balanceAfter: 800,
      status: 'reserved',
    });
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('maps insufficient funds to a stable booking error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'MERCHANT_WALLET_INSUFFICIENT' },
    });
    await expect(
      reserveMerchantShippingCharge({ rpc } as never, 'o1', 'q1')
    ).rejects.toMatchObject({ code: 'MERCHANT_WALLET_INSUFFICIENT' });
  });
});
