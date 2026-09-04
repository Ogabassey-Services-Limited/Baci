import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRepairPickupPayment } from './handle-repair-pickup-payment';
import {
  createRepairPickupPaymentMetadata,
  createRepairPickupPaymentSupabase,
  repairPickupPaymentTestMerchantId,
  repairPickupPaymentTestReference,
  repairPickupPaymentTestRepairId,
  repairPickupPaymentTestSecret,
} from './handle-repair-pickup-payment.test-support';
import { repairPickupPaymentClaims } from './repair-pickup-payment-claim';

const mocks = vi.hoisted(() => ({ bookRepairPickup: vi.fn() }));

vi.mock('@/lib/repairs/book-repair-pickup', () => ({
  bookRepairPickup: mocks.bookRepairPickup,
}));

vi.mock('@/lib/repairs/notify-repair-pickup-booking', () => ({
  notifyRepairPickupBookingAfterPayment: vi.fn().mockResolvedValue(undefined),
}));

describe('handleRepairPickupPayment conflict and claim mismatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = repairPickupPaymentTestSecret;
    mocks.bookRepairPickup.mockResolvedValue({
      ok: true,
      carrierName: 'GIG Logistics',
      pickupScheduledAt: null,
      shipmentId: 'shipment-1',
      trackingNumber: '1349000000',
    });
  });

  it('ledgers an invalid signature claim using unsigned metadata ids', async () => {
    const { client, rpc } = createRepairPickupPaymentSupabase();
    rpc.mockResolvedValueOnce({ data: [{ recorded: true }], error: null });
    const metadata = createRepairPickupPaymentMetadata();

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: { ...metadata, pickup_claim_signature: 'invalid' },
      },
      reference: repairPickupPaymentTestReference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toMatchObject({ handled: true, status: 200 });
    expect(rpc).toHaveBeenCalledWith(
      'record_repair_pickup_payment_mismatch',
      expect.objectContaining({
        p_mismatch_reason: 'claim_missing_or_invalid',
        p_merchant_id: repairPickupPaymentTestMerchantId,
        p_repair_id: repairPickupPaymentTestRepairId,
      })
    );
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('returns 503 when an invalid claim has no merchant id to ledger', async () => {
    const { client, rpc } = createRepairPickupPaymentSupabase();

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: {
          transaction_type: 'repair_pickup',
          pickup_claim_version: 1,
        },
      },
      reference: repairPickupPaymentTestReference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({
      handled: true,
      status: 503,
      body: {
        message: 'Repair pickup payment mismatch will retry until durable',
      },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('bugfix: ledgers a second different capture instead of infinite 503', async () => {
    const { client, rpc } = createRepairPickupPaymentSupabase();
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message: 'repair_pickup_payment_conflict',
        },
      })
      .mockResolvedValueOnce({ data: [{ recorded: true }], error: null });
    const secondReference = 'RPU-SECOND-CAPTURE';
    const secondMetadata = repairPickupPaymentClaims.create(
      {
        amountKobo: 825_000,
        currency: 'NGN',
        merchantId: repairPickupPaymentTestMerchantId,
        reference: secondReference,
        repairId: repairPickupPaymentTestRepairId,
      },
      repairPickupPaymentTestSecret
    );

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: secondMetadata,
      },
      reference: secondReference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({
      handled: true,
      status: 200,
      body: { message: 'Repair pickup payment requires review' },
    });
    expect(rpc).toHaveBeenCalledWith('confirm_repair_pickup_payment', {
      p_amount: 8250,
      p_currency: 'NGN',
      p_gateway_response: expect.objectContaining({
        currency: 'NGN',
      }),
      p_merchant_id: repairPickupPaymentTestMerchantId,
      p_reference: secondReference,
      p_repair_id: repairPickupPaymentTestRepairId,
    });
    expect(rpc).toHaveBeenCalledWith('record_repair_pickup_payment_mismatch', {
      p_amount: 8250,
      p_currency: 'NGN',
      p_gateway_response: expect.objectContaining({
        currency: 'NGN',
      }),
      p_merchant_id: repairPickupPaymentTestMerchantId,
      p_mismatch_reason: 'conflicting_capture',
      p_reference: secondReference,
      p_repair_id: repairPickupPaymentTestRepairId,
    });
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('asks Paystack to retry when conflicting-capture ledger persistence fails', async () => {
    const { client, rpc } = createRepairPickupPaymentSupabase();
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message: 'repair_pickup_payment_conflict',
        },
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } });

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: createRepairPickupPaymentMetadata(),
      },
      reference: repairPickupPaymentTestReference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({
      handled: true,
      status: 503,
      body: {
        message: 'Repair pickup payment mismatch will retry until durable',
      },
    });
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });
});
