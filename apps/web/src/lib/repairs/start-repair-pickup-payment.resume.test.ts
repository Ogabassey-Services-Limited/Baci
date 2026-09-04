import { beforeEach, describe, expect, it } from 'vitest';
import './start-repair-pickup-payment.test-support';
import { startRepairPickupPayment } from './start-repair-pickup-payment';
import {
  arrangeStartRepairPickupPayment,
  getStartRepairPickupPaymentMocks,
  startRepairPickupPaymentInput,
  startRepairPickupPaymentMerchantId,
} from './start-repair-pickup-payment.test-support';

const mocks = getStartRepairPickupPaymentMocks();
const input = startRepairPickupPaymentInput;
const merchantId = startRepairPickupPaymentMerchantId;

describe('startRepairPickupPayment resume and validation', () => {
  beforeEach(arrangeStartRepairPickupPayment);

  it('reclaims an unpaid pickup via the authorized RPC instead of creating a duplicate', async () => {
    const existingId = '323e4567-e89b-12d3-a456-426614174000';
    mocks.rpc.mockResolvedValueOnce({
      data: [{ id: existingId, ticket_number: 17 }],
      error: null,
    });

    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(mocks.createRepairPickupReceiverClient).toHaveBeenCalledWith(
      merchantId
    );
    expect(mocks.rpc).toHaveBeenCalledWith('find_resumable_repair_pickup', {
      p_merchant_id: merchantId,
      p_customer_email: input.customerEmail,
    });
    expect(mocks.createRepairBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      id: existingId,
      ticketNumber: 17,
    });
  });

  it('rejects invalid expected pickup fees before merchant lookup', async () => {
    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: -10,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toEqual({
      success: false,
      code: 'validation_failed',
      error: 'Enter valid repair and pickup details.',
    });
    expect(mocks.resolveWalletTopUpMerchant).not.toHaveBeenCalled();
  });

  it('rejects a non-string or oversized merchant identifier before lookup', async () => {
    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'a'.repeat(121) as never,
    });

    expect(result).toEqual({
      success: false,
      code: 'validation_failed',
      error: 'Enter valid repair and pickup details.',
    });
    expect(mocks.resolveWalletTopUpMerchant).not.toHaveBeenCalled();
  });
});
