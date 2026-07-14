import { logger } from '../logger';
import { getAccessToken } from './paypal-auth';
import { formatPayPalAmount, normalizePayPalCurrency } from './paypal-currency';
import { getPayPalBaseUrl } from './paypal-endpoints';
import {
  type PayPalMode,
  type PayPalRefundOptions,
  type PayPalRefundResponse,
  PayPalRefundResponseSchema,
  type PayPalResult,
} from './paypal-types';

/**
 * Refunds a completed PayPal capture (`POST /v2/payments/captures/{id}/refund`).
 * Not present in the prototype — added per Phase 2 item 7 (cancellation
 * route branches on gateway; PayPal refunds must go through the merchant's
 * own stored credentials, never a platform key). Omit `options.amount` for
 * a full refund of the original capture.
 */
export async function refund(
  clientId: string,
  secretKey: string,
  captureId: string,
  mode: PayPalMode = 'sandbox',
  options: PayPalRefundOptions = {}
): Promise<PayPalResult<PayPalRefundResponse>> {
  let amountPayload: { currency_code: string; value: string } | undefined;

  if (options.amount !== undefined) {
    if (!options.currency) {
      return {
        success: false,
        error: 'A currency is required when refunding a specific amount',
        code: 'INVALID_AMOUNT',
      };
    }

    const currencyResult = normalizePayPalCurrency(options.currency);
    if (!currencyResult.success) {
      return currencyResult;
    }

    const amountResult = formatPayPalAmount(
      options.amount,
      currencyResult.data
    );
    if (!amountResult.success) {
      return amountResult;
    }

    amountPayload = {
      currency_code: currencyResult.data,
      value: amountResult.data,
    };
  }

  const tokenResult = await getAccessToken(clientId, secretKey, mode);
  if (!tokenResult.success) {
    return tokenResult;
  }

  const accessToken = tokenResult.data;
  const baseUrl = getPayPalBaseUrl(mode);

  try {
    const response = await fetch(
      `${baseUrl}/v2/payments/captures/${captureId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(options.requestId
            ? { 'PayPal-Request-Id': options.requestId }
            : {}),
        },
        body: JSON.stringify({
          ...(amountPayload ? { amount: amountPayload } : {}),
          ...(options.noteToPayer
            ? { note_to_payer: options.noteToPayer }
            : {}),
        }),
      }
    );

    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal refund failed',
        status: response.status,
        error: body.message || JSON.stringify(body),
      });
      return {
        success: false,
        error: body.message || `Refund request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalRefundResponseSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid PayPal refund response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({ message: 'PayPal refund network error', error: errorMsg });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}

/**
 * Reads a PayPal refund resource (`GET /v2/payments/refunds/{id}`). Pending
 * refunds are not terminal: the reconciliation cron uses this endpoint until
 * PayPal reports COMPLETED, CANCELLED, or FAILED.
 */
export async function getRefund(
  clientId: string,
  secretKey: string,
  refundId: string,
  mode: PayPalMode = 'sandbox'
): Promise<PayPalResult<PayPalRefundResponse>> {
  const tokenResult = await getAccessToken(clientId, secretKey, mode);
  if (!tokenResult.success) {
    return tokenResult;
  }

  try {
    const response = await fetch(
      `${getPayPalBaseUrl(mode)}/v2/payments/refunds/${refundId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenResult.data}` },
      }
    );
    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal refund lookup failed',
        refundId,
        status: response.status,
        error: body.message || JSON.stringify(body),
      });
      return {
        success: false,
        error:
          body.message || `Refund status request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalRefundResponseSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid PayPal refund response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({
      message: 'PayPal refund lookup network error',
      refundId,
      error: errorMsg,
    });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}
