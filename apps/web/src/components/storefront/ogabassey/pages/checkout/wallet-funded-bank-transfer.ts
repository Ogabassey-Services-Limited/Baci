import {
  createOrderWalletFundingIntent,
  createWalletFundingAccount,
  WalletOrderFundingIntentError,
} from '@/lib/order-wallet-funding-intent-client';
import { captureClientEvent } from '@/lib/posthog/capture-client-event';
import { WALLET_ORDER_FUNDING_TELEMETRY } from '@/lib/posthog/wallet-order-funding-events';
import type { WalletOrderFundingIntentCreateResponse } from '@/schemas/order-wallet-funding-intent';

export const WALLET_CONSENT_DENIED = 'WALLET_CONSENT_DENIED';

export type WalletFundedBankTransferResult =
  | ({ kind: 'intent' } & WalletOrderFundingIntentCreateResponse)
  | { kind: 'fallback'; code: string; message: string };

interface StartWalletFundedBankTransferArgs {
  merchantId: string;
  merchantSlug?: string;
  orderId: string;
  /** Resolves true when the customer accepts wallet-account provisioning. */
  requestConsent: () => Promise<boolean>;
}

function toFallback(error: unknown, fallbackMessage: string) {
  if (error instanceof WalletOrderFundingIntentError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'other',
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

function reportFallback({
  code,
  merchantId,
  orderId,
}: {
  code: string;
  merchantId: string;
  orderId: string;
}) {
  captureClientEvent(WALLET_ORDER_FUNDING_TELEMETRY.events.fallback, {
    merchant_id: merchantId,
    order_id: orderId,
    reason: code,
  });
}

function reportCreated({
  intentId,
  merchantId,
  orderId,
  withConsent,
}: {
  intentId: string;
  merchantId: string;
  orderId: string;
  withConsent: boolean;
}) {
  captureClientEvent(WALLET_ORDER_FUNDING_TELEMETRY.events.intentCreated, {
    intent_id: intentId,
    merchant_id: merchantId,
    order_id: orderId,
    with_consent: withConsent,
  });
}

/**
 * Mirrors the mobile reference (`lib/checkout/wallet-funded-bank-transfer.ts`):
 * create the intent; on `WALLET_DVA_CONSENT_REQUIRED` ask for consent, provision
 * the wallet DVA, retry once. EVERY other outcome — including a denied consent,
 * a disabled merchant, a guest, a missing phone, a 5xx or a network error —
 * resolves to `kind: 'fallback'`, and the caller MUST then run the untouched
 * legacy order-DVA path. This function never throws.
 */
export async function startWalletFundedBankTransfer({
  merchantId,
  merchantSlug,
  orderId,
  requestConsent,
}: StartWalletFundedBankTransferArgs): Promise<WalletFundedBankTransferResult> {
  const identifiers = { merchantId, merchantSlug, orderId };

  try {
    const response = await createOrderWalletFundingIntent(identifiers);
    reportCreated({
      intentId: response.intent.id,
      merchantId,
      orderId,
      withConsent: false,
    });
    return { kind: 'intent', ...response };
  } catch (error) {
    const details = toFallback(error, 'Failed to start wallet transfer');
    if (details.code !== 'WALLET_DVA_CONSENT_REQUIRED') {
      reportFallback({ code: details.code, merchantId, orderId });
      return { kind: 'fallback', ...details };
    }
  }

  let consentGranted = false;
  try {
    consentGranted = await requestConsent();
  } catch (error) {
    const details = toFallback(error, 'Wallet consent failed');
    reportFallback({ code: details.code, merchantId, orderId });
    return { kind: 'fallback', ...details };
  }

  if (!consentGranted) {
    reportFallback({ code: WALLET_CONSENT_DENIED, merchantId, orderId });
    return {
      code: WALLET_CONSENT_DENIED,
      kind: 'fallback',
      message: 'Wallet consent declined',
    };
  }

  try {
    await createWalletFundingAccount({ merchantId, merchantSlug });
    const response = await createOrderWalletFundingIntent(identifiers);
    reportCreated({
      intentId: response.intent.id,
      merchantId,
      orderId,
      withConsent: true,
    });
    return { kind: 'intent', ...response };
  } catch (error) {
    const details = toFallback(error, 'Failed to start wallet transfer');
    reportFallback({ code: details.code, merchantId, orderId });
    return { kind: 'fallback', ...details };
  }
}
