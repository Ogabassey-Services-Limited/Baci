import { vi } from 'vitest';
import { repairPickupPaymentClaims } from './repair-pickup-payment-claim';

export const repairPickupPaymentTestSecret = 'paystack-secret-for-tests';
export const repairPickupPaymentTestMerchantId =
  '123e4567-e89b-12d3-a456-426614174000';
export const repairPickupPaymentTestRepairId =
  '223e4567-e89b-12d3-a456-426614174000';
export const repairPickupPaymentTestReference = 'RPU-ABC123';

export function createRepairPickupPaymentMetadata() {
  return repairPickupPaymentClaims.create(
    {
      amountKobo: 825_000,
      currency: 'NGN',
      merchantId: repairPickupPaymentTestMerchantId,
      reference: repairPickupPaymentTestReference,
      repairId: repairPickupPaymentTestRepairId,
    },
    repairPickupPaymentTestSecret
  );
}

export function createRepairPickupPaymentSupabase(confirmed = true) {
  const rpc = vi.fn().mockResolvedValue({
    data: [{ confirmed }],
    error: null,
  });
  const neq = vi.fn().mockResolvedValue({ error: null });
  const thirdEq = vi.fn().mockReturnValue({ neq });
  const secondEq = vi.fn().mockReturnValue({ eq: thirdEq });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const update = vi.fn().mockReturnValue({ eq: firstEq });
  const from = vi.fn().mockReturnValue({ update });
  return {
    client: { from, rpc } as never,
    firstEq,
    from,
    neq,
    rpc,
    secondEq,
    thirdEq,
    update,
  };
}
