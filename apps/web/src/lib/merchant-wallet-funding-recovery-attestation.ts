import { createHmac } from 'node:crypto';

export const MERCHANT_WALLET_FUNDING_RECOVERY_HMAC_SECRET =
  process.env.MERCHANT_WALLET_FUNDING_RECOVERY_HMAC_SECRET ??
  'baci-merchant-wallet-funding-recovery-hmac-v1';

export function createMerchantWalletFundingRecoveryAttestation(input: {
  requestId: string;
  merchantId: string;
  accountNumber: string;
  accountName: string | null;
  bankName: string | null;
  currency: string;
  providerAccountId: string | null;
  providerCustomerCode: string | null;
  attestedAtIso: string;
}): string {
  const payload = [
    input.requestId,
    input.merchantId,
    input.accountNumber,
    input.accountName ?? '',
    input.bankName ?? '',
    input.currency,
    input.providerAccountId ?? '',
    input.providerCustomerCode ?? '',
    input.attestedAtIso,
  ].join('|');
  return createHmac('sha256', MERCHANT_WALLET_FUNDING_RECOVERY_HMAC_SECRET)
    .update(payload)
    .digest('hex');
}
