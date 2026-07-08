import { logger } from '../logger';
import { getAccessToken } from './paypal-auth';
import { formatPayPalAmount, normalizePayPalCurrency } from './paypal-currency';
import { getPayPalBaseUrl } from './paypal-endpoints';
import {
  type PayPalCaptureResponse,
  PayPalCaptureResponseSchema,
  type PayPalCreateOrderOptions,
  type PayPalMode,
  type PayPalOrderDetails,
  PayPalOrderDetailsSchema,
  PayPalOrderResponseSchema,
  type PayPalResult,
} from './paypal-types';

/** Initializes a PayPal transaction by creating an Order (v2 Checkout Orders). */
export async function createOrder(
  clientId: string,
  secretKey: string,
  amount: number,
  currency: string,
  reference: string,
  mode: PayPalMode = 'sandbox',
  options: PayPalCreateOrderOptions = {}
): Promise<PayPalResult<{ id: string; approveUrl?: string }>> {
  const currencyResult = normalizePayPalCurrency(currency);
  if (!currencyResult.success) {
    return currencyResult;
  }

  const amountResult = formatPayPalAmount(amount, currencyResult.data);
  if (!amountResult.success) {
    return amountResult;
  }

  const tokenResult = await getAccessToken(clientId, secretKey, mode);
  if (!tokenResult.success) {
    return tokenResult;
  }

  const accessToken = tokenResult.data;
  const baseUrl = getPayPalBaseUrl(mode);
  const paypalCurrency = currencyResult.data;
  const finalAmount = amountResult.data;

  try {
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': reference,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: reference,
            amount: {
              currency_code: paypalCurrency,
              value: finalAmount,
            },
            description: `Store Purchase - Ref: ${reference}`,
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              ...(options.returnUrl ? { return_url: options.returnUrl } : {}),
              ...(options.cancelUrl ? { cancel_url: options.cancelUrl } : {}),
            },
          },
        },
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal order creation failed',
        status: response.status,
        error: body.message || JSON.stringify(body),
      });
      return {
        success: false,
        error: body.message || `Order creation failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalOrderResponseSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid PayPal order response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    const approveUrl = parsed.data.links.find(
      (link) => link.rel === 'approve' || link.rel === 'payer-action'
    )?.href;

    return {
      success: true,
      data: {
        id: parsed.data.id,
        approveUrl,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({
      message: 'PayPal order creation network error',
      error: errorMsg,
    });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}

/** Captures funds from an approved PayPal Order. */
export async function captureOrder(
  clientId: string,
  secretKey: string,
  orderId: string,
  mode: PayPalMode = 'sandbox',
  requestId?: string
): Promise<PayPalResult<PayPalCaptureResponse>> {
  const tokenResult = await getAccessToken(clientId, secretKey, mode);
  if (!tokenResult.success) {
    return tokenResult;
  }

  const accessToken = tokenResult.data;
  const baseUrl = getPayPalBaseUrl(mode);

  try {
    const response = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        },
      }
    );

    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal capture failed',
        status: response.status,
        error: body.message || JSON.stringify(body),
      });
      return {
        success: false,
        error: body.message || `Capture request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalCaptureResponseSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid PayPal capture response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({ message: 'PayPal capture network error', error: errorMsg });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}

/**
 * Fetches the current state of a PayPal Order by id (Orders v2 "show order
 * details"). Not in the prototype — added for the reconciliation path
 * (Phase 2 item 4: capture-succeeded-but-DB-failed review) so a route can
 * re-check an order's true status/captures against PayPal without
 * attempting a duplicate capture.
 */
export async function getOrder(
  clientId: string,
  secretKey: string,
  orderId: string,
  mode: PayPalMode = 'sandbox'
): Promise<PayPalResult<PayPalOrderDetails>> {
  const tokenResult = await getAccessToken(clientId, secretKey, mode);
  if (!tokenResult.success) {
    return tokenResult;
  }

  const accessToken = tokenResult.data;
  const baseUrl = getPayPalBaseUrl(mode);

  try {
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal get-order failed',
        status: response.status,
        error: body.message || JSON.stringify(body),
      });
      return {
        success: false,
        error: body.message || `Get order failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalOrderDetailsSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid PayPal order-details response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({
      message: 'PayPal get-order network error',
      error: errorMsg,
    });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}
