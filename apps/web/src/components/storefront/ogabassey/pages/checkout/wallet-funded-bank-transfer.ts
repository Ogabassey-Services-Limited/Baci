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
  | { kind: 'fallback'; code: string; message: string }
  /**
   * The create-intent POST outcome is INDETERMINATE — the server may already
   * hold a funding intent for this order. The caller MUST NOT open the legacy
   * order-DVA path (a second funding channel risks a double charge); it must
   * surface an "we couldn't confirm — check your wallet / retry" state instead.
   */
  | { kind: 'uncertain'; code: string; message: string };

interface StartWalletFundedBankTransferArgs {
  merchantId: string;
  merchantSlug?: string;
  orderId: string;
  /** Resolves true when the customer accepts wallet-account provisioning. */
  requestConsent: () => Promise<boolean>;
}

function classifyError(error: unknown, fallbackMessage: string) {
  if (error instanceof WalletOrderFundingIntentError) {
    return {
      code: error.code,
      indeterminate: error.indeterminate,
      message: error.message,
    };
  }
  return {
    code: 'other',
    // An unexpected non-client error only reaches here after a successful call,
    // so a definite (non-indeterminate) fallback is the safe default.
    indeterminate: false,
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

function reportUncertain({
  code,
  merchantId,
  orderId,
}: {
  code: string;
  merchantId: string;
  orderId: string;
}) {
  captureClientEvent(WALLET_ORDER_FUNDING_TELEMETRY.events.uncertain, {
    merchant_id: merchantId,
    order_id: orderId,
    reason: code,
  });
}

/**
 * Terminal result for a FAILED create-intent attempt: an indeterminate outcome
 * becomes `uncertain` (never fall back — an intent may already exist), a
 * definite one becomes `fallback` (safe to run the legacy order-DVA path).
 */
function resolveCreateFailure(
  error: unknown,
  merchantId: string,
  orderId: string
): WalletFundedBankTransferResult {
  const details = classifyError(error, 'Failed to start wallet transfer');
  if (details.indeterminate) {
    reportUncertain({ code: details.code, merchantId, orderId });
    return { code: details.code, kind: 'uncertain', message: details.message };
  }
  reportFallback({ code: details.code, merchantId, orderId });
  return { code: details.code, kind: 'fallback', message: details.message };
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
 * the wallet DVA, retry once.
 *
 * A DEFINITE decline — denied consent, a disabled merchant, a guest, a missing
 * phone, a 4xx, or a failed DVA provisioning — resolves to `kind: 'fallback'`,
 * and the caller MUST then run the untouched legacy order-DVA path.
 *
 * An INDETERMINATE create-intent outcome — a 5xx, a transport drop/timeout after
 * send, or an unreadable 2xx body — resolves to `kind: 'uncertain'`: the server
 * may already hold a funding intent for this order, so the caller MUST NOT open
 * the legacy path (a second funding channel risks a double charge) and instead
 * surfaces a "check your wallet / retry" state. This function never throws.
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
    const details = classifyError(error, 'Failed to start wallet transfer');
    // A consent-required 409 is a definite server response (never
    // indeterminate) and is the ONLY code that continues to the consent flow.
    if (details.code !== 'WALLET_DVA_CONSENT_REQUIRED') {
      return resolveCreateFailure(error, merchantId, orderId);
    }
  }

  let consentGranted = false;
  try {
    consentGranted = await requestConsent();
  } catch (error) {
    const details = classifyError(error, 'Wallet consent failed');
    reportFallback({ code: details.code, merchantId, orderId });
    return { code: details.code, kind: 'fallback', message: details.message };
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
    // Provisioning the standing wallet DVA is NOT an order-funding path: any
    // failure here (even a 5xx) safely falls back to legacy order-DVA because no
    // order-funding intent was created yet — no double-charge risk.
    await createWalletFundingAccount({ merchantId, merchantSlug });
  } catch (error) {
    const details = classifyError(error, 'Failed to set up your wallet account');
    reportFallback({ code: details.code, merchantId, orderId });
    return { code: details.code, kind: 'fallback', message: details.message };
  }

  try {
    const response = await createOrderWalletFundingIntent(identifiers);
    reportCreated({
      intentId: response.intent.id,
      merchantId,
      orderId,
      withConsent: true,
    });
    return { kind: 'intent', ...response };
  } catch (error) {
    // Same money-safety rule as the first attempt: indeterminate → uncertain.
    return resolveCreateFailure(error, merchantId, orderId);
  }
}
