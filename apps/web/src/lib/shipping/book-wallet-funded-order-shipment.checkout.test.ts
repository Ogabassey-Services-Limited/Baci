import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./merchant-shipping-charge', () => ({
  reserveMerchantShippingCharge: vi.fn(),
  beginMerchantShippingChargeSubmission: vi.fn(),
  completeMerchantShippingCharge: vi.fn(),
  recoverMerchantShippingChargeForPersistedShipment: vi.fn(),
  refundMerchantShippingCharge: vi.fn(),
  markMerchantShippingChargeForReconciliation: vi.fn(),
}));

import { bookWalletOrCustomerCheckout } from './book-wallet-funded-order-shipment';
import { supabaseFixture } from './book-wallet-funded-order-shipment.test-support';
import * as charge from './merchant-shipping-charge';
import { OrderShipmentBookingError } from './order-shipment-booking-utils';

describe('wallet-funded shipment orchestration — checkout', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not invoke GIGL when reservation reports insufficient funds', async () => {
    vi.mocked(charge.reserveMerchantShippingCharge).mockRejectedValue(
      new OrderShipmentBookingError(
        'insufficient',
        409,
        'MERCHANT_WALLET_INSUFFICIENT'
      )
    );
    const book = vi.fn();
    await expect(
      bookWalletOrCustomerCheckout(
        supabaseFixture,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        book
      )
    ).rejects.toMatchObject({ code: 'MERCHANT_WALLET_INSUFFICIENT' });
    expect(book).not.toHaveBeenCalled();
  });

  it('never calls wallet RPCs for customer checkout', async () => {
    const book = vi.fn().mockResolvedValue({ shipmentId: 's1' });
    await bookWalletOrCustomerCheckout(
      supabaseFixture,
      'm1',
      'o1',
      'q1',
      'customer_checkout',
      book
    );
    expect(book).toHaveBeenCalledOnce();
    expect(charge.reserveMerchantShippingCharge).not.toHaveBeenCalled();
  });
});
