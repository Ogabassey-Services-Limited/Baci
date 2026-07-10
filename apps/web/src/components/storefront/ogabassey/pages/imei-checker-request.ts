import type { ImeiServiceTierKey } from '@baci/shared/imei';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  DEFAULT_IMEI_CHECK_ERROR_MESSAGE,
  resolveImeiCheckFailure,
} from './imei-checker-resolve-failure';
import type { ImeiResult } from './imei-checker-types';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

interface ImeiCheckOutcome {
  result: ImeiResult | null;
  error: string | null;
  keepRequestIdentity: boolean;
  needsWalletFunding: boolean;
}

function describeCheckFailure(
  outcome: ReturnType<typeof resolveImeiCheckFailure>
): string {
  if (outcome.errorMessage !== null) {
    return outcome.errorMessage;
  }

  if (outcome.shouldRedirectToLogin) {
    return 'Please sign in to check this device.';
  }

  if (outcome.topUpAmount !== null) {
    return `Insufficient wallet balance. You need ${currencyFormatter.format(outcome.topUpAmount)} more to run this check.`;
  }

  return DEFAULT_IMEI_CHECK_ERROR_MESSAGE;
}

export async function performImeiCheck(
  imei: string,
  tier: ImeiServiceTierKey,
  tierPrice: number,
  idempotencyKey: string
): Promise<ImeiCheckOutcome> {
  try {
    const response = await fetchWithCsrf('/api/storefront/imei-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ imei, tier }),
    });

    const data: {
      success?: boolean;
      error?: string;
      code?: string;
      data?: ImeiResult;
      balance?: number;
      required?: number;
    } = await response.json();

    if (!response.ok || !data.success) {
      const outcome = resolveImeiCheckFailure({
        currentTierPrice: tierPrice,
        payload: data,
        responseStatus: response.status,
        walletBalance: 0,
      });

      return {
        result: null,
        error: describeCheckFailure(outcome),
        keepRequestIdentity: outcome.shouldPreserveIdempotencyKey,
        needsWalletFunding:
          response.status === 402 && data.code === 'WALLET_INSUFFICIENT',
      };
    }

    return {
      result: data.data ?? null,
      error: null,
      keepRequestIdentity: false,
      needsWalletFunding: false,
    };
  } catch (error) {
    console.error('IMEI check failed:', error);
    return {
      result: null,
      error: 'Network error. Please check your connection and try again.',
      keepRequestIdentity: true,
      needsWalletFunding: false,
    };
  }
}
