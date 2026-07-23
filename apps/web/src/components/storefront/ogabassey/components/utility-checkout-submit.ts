import { fetchWithCsrf } from '@/lib/api-client';
import {
  getCheckoutErrorMessage,
  isUtilityCheckoutResponse,
  redirectToPaymentCheckout,
  type UtilityCheckoutPayload,
} from './utility-checkout';

export interface UtilityCheckoutRequest {
  payload: UtilityCheckoutPayload;
  merchantSlug: string;
  customerName: string;
  customerPhone: string | null | undefined;
  walletAmount: number;
  getWalletIdempotencyKey: (payloadSignature: string) => string;
}

export type UtilityCheckoutResult =
  | { kind: 'redirected' }
  | {
      kind: 'wallet-success';
      reference: string;
      amount: number;
      processing: boolean;
    }
  | { kind: 'error'; message: string };

/**
 * Module-scope helper: keeps try/finally + throw-in-try out of the component
 * body so React Compiler can memoize the caller. Extracted from `UtilityModal`
 * to keep that component under the 300-line modularity budget.
 */
export const submitUtilityCheckout = async ({
  payload,
  merchantSlug,
  customerName,
  customerPhone,
  walletAmount,
  getWalletIdempotencyKey,
}: UtilityCheckoutRequest): Promise<UtilityCheckoutResult> => {
  try {
    const checkoutPayload = {
      merchantSlug,
      customerName,
      ...(customerPhone ? { customerPhone } : {}),
      ...payload,
    };
    const isWalletOnly = walletAmount > 0 && walletAmount >= payload.amount;
    const walletPayload = {
      ...checkoutPayload,
      walletAmount: payload.amount,
    };
    const response = await fetchWithCsrf(
      isWalletOnly
        ? '/api/vtu/checkout/wallet-only'
        : '/api/vtu/checkout/initialize',
      {
        method: 'POST',
        headers: isWalletOnly
          ? {
              'Idempotency-Key': getWalletIdempotencyKey(
                JSON.stringify(walletPayload)
              ),
            }
          : undefined,
        body: JSON.stringify({
          ...(isWalletOnly ? walletPayload : checkoutPayload),
          ...(isWalletOnly
            ? {}
            : {
                gateway: 'paystack',
                ...(walletAmount > 0 ? { walletAmount } : {}),
              }),
        }),
      }
    );

    const rawResponse = await response.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawResponse);
    } catch {
      throw new Error(
        response.ok
          ? 'Payment checkout returned an invalid response'
          : `Payment checkout failed (${response.status})`
      );
    }
    if (!response.ok) throw new Error(getCheckoutErrorMessage(parsedData));
    if (!isUtilityCheckoutResponse(parsedData)) {
      throw new Error('Payment checkout returned an invalid response');
    }
    const data = parsedData;

    if (!isWalletOnly) {
      const checkoutUrl = data.checkout_url || data.authorization_url;
      if (!checkoutUrl) {
        throw new Error('Payment checkout URL was not returned');
      }
      redirectToPaymentCheckout(checkoutUrl);
      return { kind: 'redirected' };
    }

    return {
      kind: 'wallet-success',
      reference: data.reference ?? '',
      amount: data.amount ?? payload.amount,
      processing: data.status === 'processing',
    };
  } catch (error) {
    return {
      kind: 'error',
      message:
        error instanceof Error ? error.message : 'Something went wrong',
    };
  }
};
