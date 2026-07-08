import { logger } from '../logger';
import { getPayPalBaseUrl } from './paypal-endpoints';
import {
  type PayPalMode,
  PayPalOAuthSchema,
  type PayPalResult,
} from './paypal-types';

function buildBasicAuthHeader(clientId: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secretKey}`).toString('base64')}`;
}

/** Obtains an OAuth 2.0 access token from PayPal using client credentials. */
export async function getAccessToken(
  clientId: string,
  secretKey: string,
  mode: PayPalMode = 'sandbox'
): Promise<PayPalResult<string>> {
  if (!clientId || !secretKey) {
    return {
      success: false,
      error: 'Missing PayPal Client ID or Secret Key',
      code: 'MISSING_CREDENTIALS',
    };
  }

  const baseUrl = getPayPalBaseUrl(mode);

  try {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: buildBasicAuthHeader(clientId, secretKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal OAuth failed',
        status: response.status,
        error: body.error_description || body.error || 'Unknown error',
      });
      return {
        success: false,
        error:
          body.error_description || `OAuth request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalOAuthSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid PayPal OAuth response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    return { success: true, data: parsed.data.access_token };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({ message: 'PayPal OAuth network error', error: errorMsg });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}

/** Generates a browser-safe client token for frontend PayPal JS SDK initialization. */
export async function generateClientToken(
  clientId: string,
  secretKey: string,
  mode: PayPalMode = 'sandbox'
): Promise<PayPalResult<string>> {
  if (!clientId || !secretKey) {
    return {
      success: false,
      error: 'Missing PayPal Client ID or Secret Key',
      code: 'MISSING_CREDENTIALS',
    };
  }

  const baseUrl = getPayPalBaseUrl(mode);
  const formBody = new URLSearchParams({
    grant_type: 'client_credentials',
    response_type: 'client_token',
  });

  try {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: buildBasicAuthHeader(clientId, secretKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    const body = await response.json();

    if (!response.ok) {
      logger.error({
        message: 'PayPal client token generation failed',
        status: response.status,
        error: body.error_description || body.error || 'Unknown error',
      });
      return {
        success: false,
        error:
          body.error_description ||
          `Token generation failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const parsed = PayPalOAuthSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid client token response format',
        code: 'SCHEMA_MISMATCH',
      };
    }

    return { success: true, data: parsed.data.access_token };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    logger.error({
      message: 'PayPal client token network error',
      error: errorMsg,
    });
    return { success: false, error: errorMsg, code: 'NETWORK_ERROR' };
  }
}
