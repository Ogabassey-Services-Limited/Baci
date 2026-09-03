import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createMerchantWalletFundingRecoveryAttestation,
  MERCHANT_WALLET_FUNDING_RECOVERY_HMAC_SECRET,
} from './merchant-wallet-funding-recovery-attestation';

describe('createMerchantWalletFundingRecoveryAttestation', () => {
  it('HMACs the recovery payload with the funding-recovery secret', () => {
    const attestedAtIso = '2026-09-03T20:00:00.000Z';
    const attestation = createMerchantWalletFundingRecoveryAttestation({
      requestId: 'r1',
      merchantId: 'm1',
      accountNumber: '1234567890',
      accountName: 'Wallet',
      bankName: 'Wema',
      currency: 'NGN',
      providerAccountId: '9',
      providerCustomerCode: 'CUS_1',
      attestedAtIso,
    });

    expect(attestation).toBe(
      createHmac('sha256', MERCHANT_WALLET_FUNDING_RECOVERY_HMAC_SECRET)
        .update(
          [
            'r1',
            'm1',
            '1234567890',
            'Wallet',
            'Wema',
            'NGN',
            '9',
            'CUS_1',
            attestedAtIso,
          ].join('|')
        )
        .digest('hex')
    );
  });
});
