import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./merchant-shipping-charge', () => ({
  reserveMerchantShippingCharge: vi.fn(),
  beginMerchantShippingChargeSubmission: vi.fn(),
  completeMerchantShippingCharge: vi.fn(),
  refundMerchantShippingCharge: vi.fn(),
  markMerchantShippingChargeForReconciliation: vi.fn(),
}));

import { bookWalletOrCustomerCheckout } from './book-wallet-funded-order-shipment';
import * as charge from './merchant-shipping-charge';
import { OrderShipmentBookingError } from './order-shipment-booking-utils';

function reservedChargeQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: 'charge-reserved' },
      error: null,
    }),
  };
}

describe('wallet-funded shipment orchestration — process-death recovery', () => {
  beforeEach(() => vi.resetAllMocks());

  it('rotates a recovered reservation token before quote refresh and refunds when reconfirmation is required', async () => {
    const events: string[] = [];
    const release = vi.fn().mockResolvedValue(undefined);
    const supabase = {
      from: vi.fn(() => reservedChargeQuery()),
    };
    const book = vi.fn();
    const rotatedToken = 'rotated-token';
    vi.mocked(charge.reserveMerchantShippingCharge).mockImplementation(
      async () => {
        events.push('reserve');
        return {
          charge: {
            chargeId: 'charge-reserved',
            chargedAmount: 100,
            balanceAfter: 0,
            status: 'reserved',
          },
          token: rotatedToken,
        };
      }
    );
    const prepareQuote = vi.fn().mockImplementation(async () => {
      events.push('prepare');
      throw new OrderShipmentBookingError(
        'The shipping quote changed.',
        409,
        'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED'
      );
    });

    await expect(
      bookWalletOrCustomerCheckout(
        supabase as never,
        'm1',
        'o1',
        'q-stale',
        'merchant_wallet',
        book,
        release,
        prepareQuote
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
    });

    expect(events).toEqual(['reserve', 'prepare']);
    expect(charge.refundMerchantShippingCharge).toHaveBeenCalledWith(
      supabase,
      'charge-reserved',
      rotatedToken,
      'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED'
    );
    expect(release).toHaveBeenCalledOnce();
    expect(book).not.toHaveBeenCalled();
    expect(charge.beginMerchantShippingChargeSubmission).not.toHaveBeenCalled();
  });

  it('refreshes after rotating a reservation when the charge lookup is inconclusive', async () => {
    const events: string[] = [];
    const release = vi.fn().mockResolvedValue(undefined);
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('temporary read failure'),
        }),
      })),
    };
    vi.mocked(charge.reserveMerchantShippingCharge).mockImplementation(
      async () => {
        events.push('reserve');
        return {
          charge: {
            chargeId: 'charge-reserved',
            chargedAmount: 100,
            balanceAfter: 0,
            status: 'reserved',
          },
          token: 'rotated-token',
        };
      }
    );
    const prepareQuote = vi.fn().mockImplementation(async () => {
      events.push('prepare');
      return 'q-replacement';
    });
    const book = vi.fn();

    await expect(
      bookWalletOrCustomerCheckout(
        supabase as never,
        'm1',
        'o1',
        'q-stale',
        'merchant_wallet',
        book,
        release,
        prepareQuote
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
    });

    expect(events).toEqual(['reserve', 'prepare']);
    expect(charge.refundMerchantShippingCharge).toHaveBeenCalledWith(
      supabase,
      'charge-reserved',
      'rotated-token',
      'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED'
    );
    expect(release).toHaveBeenCalledOnce();
    expect(book).not.toHaveBeenCalled();
    expect(charge.beginMerchantShippingChargeSubmission).not.toHaveBeenCalled();
  });
});
