import type { SupabaseClient } from '@supabase/supabase-js';
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

const supabaseFixture = {} as SupabaseClient;

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
      supabaseFixture,
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

  it('refreshes the quote before reserving wallet funds', async () => {
    const events: string[] = [];
    vi.mocked(charge.reserveMerchantShippingCharge).mockImplementation(
      async (_supabase, _orderId, quoteId) => {
        events.push(`reserve:${quoteId}`);
        return {
          charge: {
            chargeId: 'c-refresh',
            chargedAmount: 100,
            balanceAfter: 0,
            status: 'reserved',
          },
          token: 'q'.repeat(64),
        };
      }
    );
    vi.mocked(charge.beginMerchantShippingChargeSubmission).mockImplementation(
      async () => {
        events.push('begin');
        return null;
      }
    );
    const prepareQuote = vi.fn(async () => {
      events.push('refresh');
      return 'q-fresh';
    });
    const book = vi.fn(async (quoteId?: string) => {
      events.push(`book:${quoteId}`);
      return {
        shipmentId: 's-refresh',
        provider: 'GIGL' as const,
        providerShipmentId: 'p-refresh',
        trackingNumber: 't-refresh',
        carrierName: 'GIGL',
        quoteId: 'q-fresh',
        estimatedDays: null,
        shipmentStatus: 'booked' as const,
      };
    });

    await bookWalletOrCustomerCheckout(
      supabaseFixture,
      'm1',
      'o1',
      'q-stale',
      'merchant_wallet',
      book,
      undefined,
      prepareQuote
    );

    expect(prepareQuote).toHaveBeenCalledOnce();
    expect(events).toEqual([
      'refresh',
      'reserve:q-fresh',
      'begin',
      'book:q-fresh',
    ]);
  });

  it('releases the lock when quote preparation fails before reservation', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const prepareQuote = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError(
          'Quote metadata unavailable',
          500,
          'QUOTE_METADATA_LOOKUP_FAILED'
        )
      );

    await expect(
      bookWalletOrCustomerCheckout(
        supabaseFixture,
        'm1',
        'o1',
        'q-stale',
        'merchant_wallet',
        vi.fn(),
        release,
        prepareQuote
      )
    ).rejects.toMatchObject({ code: 'QUOTE_METADATA_LOOKUP_FAILED' });

    expect(release).toHaveBeenCalledOnce();
    expect(charge.reserveMerchantShippingCharge).not.toHaveBeenCalled();
  });

  it('returns an existing booked shipment before preparing a quote', async () => {
    const existing = {
      shipmentId: 's-existing',
      provider: 'GIGL' as const,
      providerShipmentId: 'p-existing',
      trackingNumber: 't-existing',
      carrierName: 'GIGL',
      quoteId: 'q-existing',
      estimatedDays: null,
      shipmentStatus: 'booked' as const,
    };
    const prepareQuote = vi
      .fn()
      .mockRejectedValue(new Error('stale quote should not be prepared'));
    const readExistingShipment = vi.fn().mockResolvedValue(existing);

    await expect(
      bookWalletOrCustomerCheckout(
        supabaseFixture,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        vi.fn(),
        undefined,
        prepareQuote,
        readExistingShipment
      )
    ).resolves.toEqual(existing);

    expect(readExistingShipment).toHaveBeenCalledOnce();
    expect(prepareQuote).not.toHaveBeenCalled();
    expect(charge.reserveMerchantShippingCharge).not.toHaveBeenCalled();
  });

  it('releases the lock and skips reservation when existing-shipment lookup fails', async () => {
    const release = vi.fn().mockRejectedValue(new Error('lock release failed'));
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const readExistingShipment = vi
      .fn()
      .mockRejectedValue(
        new OrderShipmentBookingError(
          'Unable to verify existing shipment.',
          500,
          'EXISTING_SHIPMENT_LOOKUP_FAILED'
        )
      );

    await expect(
      bookWalletOrCustomerCheckout(
        supabaseFixture,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        vi.fn(),
        release,
        undefined,
        readExistingShipment
      )
    ).rejects.toMatchObject({ code: 'EXISTING_SHIPMENT_LOOKUP_FAILED' });

    expect(release).toHaveBeenCalledOnce();
    expect(charge.reserveMerchantShippingCharge).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to release shipment booking lock after existing-shipment lookup error:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
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
        supabaseFixture,
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
        supabaseFixture,
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
        supabaseFixture,
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

  it('persists provider reference when local shipment save fails after provider booking', async () => {
    vi.mocked(charge.reserveMerchantShippingCharge).mockResolvedValue({
      charge: {
        chargeId: 'c-provider-ref',
        chargedAmount: 100,
        balanceAfter: 0,
        status: 'reserved',
      },
      token: 'p'.repeat(64),
    });
    const providerSaveFailure = new OrderShipmentBookingError(
      'Shipment booked with GIGL but could not be saved locally. Tracking: TRK-1',
      500,
      'SHIPMENT_SAVE_FAILED',
      'provider-shipment-1'
    );
    const book = vi.fn().mockRejectedValue(providerSaveFailure);

    await expect(
      bookWalletOrCustomerCheckout(
        supabaseFixture,
        'm1',
        'o1',
        'q1',
        'merchant_wallet',
        book
      )
    ).rejects.toMatchObject({ code: 'SHIPMENT_SAVE_FAILED' });

    expect(
      charge.markMerchantShippingChargeForReconciliation
    ).toHaveBeenCalledWith(
      expect.anything(),
      'c-provider-ref',
      'p'.repeat(64),
      'SHIPMENT_SAVE_FAILED',
      'provider-shipment-1'
    );
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
        supabaseFixture,
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
        supabaseFixture,
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
        supabaseFixture,
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
        supabaseFixture,
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
        supabaseFixture,
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
