import crypto from 'node:crypto';
import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
export interface GA4UserData {
  clientId: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}
export interface GA4EventParams {
  currency?: string;
  value?: number;
  transaction_id?: string;
  items?: Array<{
    item_id: string;
    item_name: string;
    price?: number;
    quantity?: number;
    item_category?: string;
  }>;
  search_term?: string;
  page_location?: string;
  page_title?: string;
  [key: string]: unknown;
}
export type GA4EventName =
  | 'page_view'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'add_to_wishlist'
  | 'sign_up'
  | 'login';
export function generateClientId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = crypto.randomInt(1000000000, 9999999999);
  return `${random}.${timestamp}`;
}
export function extractClientIdFromCookie(
  gaCookie: string | undefined
): string {
  if (!gaCookie) return generateClientId();
  const parts = gaCookie.split('.');
  if (parts.length >= 4) {
    return `${parts[2]}.${parts[3]}`;
  }
  return generateClientId();
}
interface GA4ValidationMessage {
  description?: string;
  fieldPath?: string;
  validationCode?: string;
}
function projectValidationMessages(
  value: unknown,
  sensitiveValues: readonly string[]
): GA4ValidationMessage[] | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('validationMessages' in value) ||
    !Array.isArray(value.validationMessages)
  ) {
    return null;
  }
  return value.validationMessages.map((message: unknown) => {
    if (!message || typeof message !== 'object') return {};
    return {
      ...('description' in message && typeof message.description === 'string'
        ? {
            description: sanitizeEventErrorMessage(
              message.description,
              sensitiveValues
            ),
          }
        : {}),
      ...('fieldPath' in message && typeof message.fieldPath === 'string'
        ? {
            fieldPath: sanitizeEventErrorMessage(
              message.fieldPath,
              sensitiveValues
            ),
          }
        : {}),
      ...('validationCode' in message &&
      typeof message.validationCode === 'string'
        ? {
            validationCode: sanitizeEventErrorMessage(
              message.validationCode,
              sensitiveValues
            ),
          }
        : {}),
    };
  });
}
export async function sendGA4Event(
  measurementId: string,
  apiSecret: string,
  eventName: GA4EventName | string,
  userData: GA4UserData,
  params?: GA4EventParams,
  debug: boolean = false,
  signal?: AbortSignal,
  eventTimestampMicros?: number
): Promise<{ success: boolean; error?: string; debugInfo?: unknown }> {
  if (!measurementId || !apiSecret) {
    return { success: false, error: 'Missing measurement ID or API secret' };
  }
  if (!userData.clientId) {
    return { success: false, error: 'Client ID is required' };
  }
  const endpoint = debug ? GA4_DEBUG_ENDPOINT : GA4_ENDPOINT;
  const url = `${endpoint}?${new URLSearchParams({
    api_secret: apiSecret,
    measurement_id: measurementId,
  }).toString()}`;
  const sensitiveValues = [measurementId, apiSecret];
  const payload = {
    client_id: userData.clientId,
    ...(userData.userId && { user_id: userData.userId }),
    events: [
      {
        name: eventName,
        ...(eventTimestampMicros !== undefined && {
          timestamp_micros: eventTimestampMicros,
        }),
        params: {
          ...(params || {}),
          ...(userData.sessionId && { session_id: userData.sessionId }),
          engagement_time_msec: 100,
        },
      },
    ],
    ...(userData.ipAddress && { ip_override: userData.ipAddress }),
  };
  try {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userData.userAgent && { 'User-Agent': userData.userAgent }),
      },
      body: JSON.stringify(payload),
      signal: requestSignal,
    });
    if (debug) {
      const debugResponse: unknown = await response.json();
      const validationMessages = projectValidationMessages(
        debugResponse,
        sensitiveValues
      );
      return {
        success:
          response.ok &&
          validationMessages !== null &&
          validationMessages.length === 0,
        debugInfo: { validationMessages: validationMessages ?? [] },
      };
    }
    if (response.status === 204 || response.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${response.status}` };
  } catch (error) {
    const safeError = sanitizeEventErrorMessage(
      error instanceof Error ? error.message : 'Network error',
      sensitiveValues
    );
    console.error(
      sanitizeEventErrorMessage(
        'GA4 Measurement Protocol error:',
        sensitiveValues
      ),
      safeError
    );
    return {
      success: false,
      error: safeError,
    };
  }
}
export const ga4MeasurementProtocol = {
  purchase: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    transactionId: string,
    value: number,
    currency: string,
    products: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      category?: string;
    }>
  ) =>
    sendGA4Event(measurementId, apiSecret, 'purchase', userData, {
      transaction_id: transactionId,
      value,
      currency,
      items: products.map((p) => ({
        item_id: p.id,
        item_name: p.name,
        price: p.price,
        quantity: p.quantity,
        item_category: p.category,
      })),
    }),
  beginCheckout: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    value: number,
    currency: string,
    products: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>
  ) =>
    sendGA4Event(measurementId, apiSecret, 'begin_checkout', userData, {
      value,
      currency,
      items: products.map((p) => ({
        item_id: p.id,
        item_name: p.name,
        price: p.price,
        quantity: p.quantity,
      })),
    }),
  addToCart: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    currency: string
  ) =>
    sendGA4Event(measurementId, apiSecret, 'add_to_cart', userData, {
      currency,
      value: price * quantity,
      items: [
        {
          item_id: productId,
          item_name: productName,
          price,
          quantity,
        },
      ],
    }),
  viewItem: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    productId: string,
    productName: string,
    price: number,
    currency: string,
    category?: string
  ) =>
    sendGA4Event(measurementId, apiSecret, 'view_item', userData, {
      currency,
      value: price,
      items: [
        {
          item_id: productId,
          item_name: productName,
          price,
          quantity: 1,
          item_category: category,
        },
      ],
    }),

  search: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    searchTerm: string
  ) =>
    sendGA4Event(measurementId, apiSecret, 'search', userData, {
      search_term: searchTerm,
    }),
};
