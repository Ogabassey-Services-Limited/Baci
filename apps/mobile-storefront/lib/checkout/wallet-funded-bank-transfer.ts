import {
  createOrderWalletFundingIntent,
  type WalletOrderFundingIntentCreateResponse,
} from "@/lib/order-wallet-funding-intent";
import { createWalletFundingAccount } from "@/lib/wallet-funding-account";

export const WALLET_CONSENT_DENIED = "WALLET_CONSENT_DENIED";

export interface WalletFundedBankTransferFallback {
  code?: string;
  consent: boolean;
  error: unknown;
  message: string;
}

export function getWalletFundingErrorDetails(error: unknown) {
  const code = typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
  return {
    code,
    error,
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

function createIntentForOrder({
  merchantId,
  merchantSlug,
  orderId,
}: {
  merchantId: string;
  merchantSlug: string;
  orderId: string;
}) {
  return createOrderWalletFundingIntent({
    merchantId,
    merchantSlug,
    orderId,
  });
}

export async function createWalletFundedBankTransferIntent({
  merchantId,
  merchantSlug,
  onFallback,
  onSuccess,
  orderId,
  requestConsent,
}: {
  merchantId: string;
  merchantSlug: string;
  onFallback: (fallback: WalletFundedBankTransferFallback) => void;
  onSuccess: (response: WalletOrderFundingIntentCreateResponse) => void;
  orderId: string;
  requestConsent: () => Promise<boolean>;
}) {
  try {
    const response = await createIntentForOrder({
      merchantId,
      merchantSlug,
      orderId,
    });
    onSuccess(response);
    return true;
  } catch (error) {
    const errorDetails = getWalletFundingErrorDetails(error);
    if (errorDetails.code !== "WALLET_DVA_CONSENT_REQUIRED") {
      onFallback({
        code: errorDetails.code,
        consent: false,
        error: errorDetails.error,
        message: errorDetails.message,
      });
      return false;
    }
  }

  let consentGranted: boolean;
  try {
    consentGranted = await requestConsent();
  } catch (error) {
    const errorDetails = getWalletFundingErrorDetails(error);
    onFallback({
      code: errorDetails.code,
      consent: false,
      error: errorDetails.error,
      message: errorDetails.message,
    });
    return false;
  }
  if (!consentGranted) {
    onFallback({
      code: WALLET_CONSENT_DENIED,
      consent: false,
      error: null,
      message: "User denied wallet consent",
    });
    return false;
  }

  try {
    await createWalletFundingAccount({ merchantId, merchantSlug });
    const response = await createIntentForOrder({
      merchantId,
      merchantSlug,
      orderId,
    });
    onSuccess(response);
    return true;
  } catch (error) {
    const errorDetails = getWalletFundingErrorDetails(error);
    onFallback({
      code: errorDetails.code,
      consent: true,
      error: errorDetails.error,
      message: errorDetails.message,
    });
    return false;
  }
}
