import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookWalletOrCustomerCheckout } from './book-wallet-funded-order-shipment';
import * as charge from './merchant-shipping-charge';
import { OrderShipmentBookingError } from './order-shipment-booking-utils';

vi.mock('./merchant-shipping-charge', () => ({
  reserveMerchantShippingCharge: vi.fn(),
  beginMerchantShippingChargeSubmission: vi.fn(),
  completeMerchantShippingCharge: vi.fn(),
  refundMerchantShippingCharge: vi.fn(),
  markMerchantShippingChargeForReconciliation: vi.fn(),
}));

describe('wallet-funded shipment orchestration', () => {
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
        {} as never,
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
      {} as never,
      'm1',
      'o1',
      'q1',
      'customer_checkout',
      book
    );
    expect(book).toHaveBeenCalledOnce();
    expect(charge.reserveMerchantShippingCharge).not.toHaveBeenCalled();
  });

  it('reserves before booking and completes after persistence', async () => {
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c1',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'a'.repeat(64),
    });
    const book = vi.fn().mockResolvedValue({ shipmentId: 's1' });
    await bookWalletOrCustomerCheckout(
      {} as never,
      'm1',
      'o1',
      'q1',
      'merchant_wallet',
      book
    );
    expect(
      vi.mocked(charge.beginMerchantShippingChargeSubmission).mock
        .invocationCallOrder[0]
    ).toBeLessThan(book.mock.invocationCallOrder[0]);
    expect(charge.completeMerchantShippingCharge).toHaveBeenCalledWith(
      expect.anything(),
      'c1',
      'a'.repeat(64),
      's1'
    );
  });

  it('refunds and releases the lock when submission cannot begin before provider booking', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c-submit',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 's'.repeat(64),
    });
    vi.mocked(charge.beginMerchantShippingChargeSubmission).mockRejectedValue(
      new OrderShipmentBookingError(
        'Unable to begin shipment submission.',
        500,
        'MERCHANT_WALLET_SUBMISSION_FAILED'
      )
    );
    const book = vi.fn();

    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        book,
        release
      )
    ).rejects.toMatchObject({ code: 'MERCHANT_WALLET_SUBMISSION_FAILED' });

    expect(book).not.toHaveBeenCalled();
    expect(charge.refundMerchantShippingCharge).toHaveBeenCalledWith(
      expect.anything(),
      'c-submit',
      's'.repeat(64),
      'MERCHANT_WALLET_SUBMISSION_FAILED'
    );
    expect(
      charge.markMerchantShippingChargeForReconciliation
    ).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it('refunds definitive rejection but reconciles ambiguous failures', async () => {
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c1',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'b'.repeat(64),
    });
    const definitive = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError('bad quote', 400, 'QUOTE_NOT_FOUND')
      );
    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        definitive
      )
    ).rejects.toThrow();
    expect(charge.refundMerchantShippingCharge).toHaveBeenCalled();
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c2',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'c'.repeat(64),
    });
    const ambiguous = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError('timeout', 504, 'PROVIDER_TIMEOUT')
      );
    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        ambiguous
      )
    ).rejects.toThrow();
    expect(
      charge.markMerchantShippingChargeForReconciliation
    ).toHaveBeenCalled();
  });

  it('releases the booking lock only for definitive failures', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c3',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'd'.repeat(64),
    });
    const definitive = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError('bad quote', 400, 'QUOTE_NOT_FOUND')
      );
    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        definitive,
        release
      )
    ).rejects.toThrow();
    expect(release).toHaveBeenCalledOnce();

    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c4',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'e'.repeat(64),
    });
    const timeout = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError('timeout', 504, 'PROVIDER_TIMEOUT')
      );
    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        timeout,
        release
      )
    ).rejects.toThrow();
    expect(release).toHaveBeenCalledOnce();
  });

  it('refunds once and releases the lock when wallet quote reconfirmation is required', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c-requote',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'r'.repeat(64),
    });
    const book = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError(
          'Please reconfirm shipping',
          409,
          'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED'
        )
      );

    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        book,
        release
      )
    ).rejects.toMatchObject({
      code: 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED',
    });

    expect(charge.refundMerchantShippingCharge).toHaveBeenCalledTimes(1);
    expect(
      charge.markMerchantShippingChargeForReconciliation
    ).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('returns an existing booked shipment without beginning another provider attempt', async () => {
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c5',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'booked',
      },
      token: 'f'.repeat(64),
    });
    const existing = vi.fn().mockResolvedValue({ shipmentId: 's-existing' });
    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        existing
      )
    ).resolves.toMatchObject({ shipmentId: 's-existing' });
    expect(charge.beginMerchantShippingChargeSubmission).not.toHaveBeenCalled();
  });

  it('fails closed for a possibly-started provider submission', async () => {
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c6',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'provider_submitting',
      },
      token: 'g'.repeat(64),
    });
    const book = vi.fn();
    await expect(
      bookWalletOrCustomerCheckout(
        {} as never,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        book
      )
    ).rejects.toMatchObject({ code: 'SHIPMENT_BOOKING_IN_PROGRESS' });
    expect(book).not.toHaveBeenCalled();
    expect(charge.beginMerchantShippingChargeSubmission).not.toHaveBeenCalled();
  });
});
