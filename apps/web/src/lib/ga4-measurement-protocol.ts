import crypto from 'node:crypto';

/**
 * Google Analytics 4 Measurement Protocol (Server-Side)
 *
 * Server-side event tracking for GA4.
 * This bypasses ad blockers and provides more accurate attribution.
 *
 * Required setup:
 * 1. Go to GA4 Admin > Data Streams > Your Stream
 * 2. Click "Measurement Protocol API secrets"
 * 3. Create a new secret and save it
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

export interface GA4UserData {
  clientId: string; // Required - from _ga cookie or generated
  userId?: string; // Optional - logged in user ID
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

/**
 * Generate a client ID in the same format as GA4
 */
export function generateClientId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = crypto.randomInt(1000000000, 9999999999);
  return `${random}.${timestamp}`;
}

/**
 * Extract client ID from GA cookie
 */
export function extractClientIdFromCookie(
  gaCookie: string | undefined
): string {
  if (!gaCookie) return generateClientId();
  // GA cookie format: GA1.1.123456789.1234567890
  const parts = gaCookie.split('.');
  if (parts.length >= 4) {
    return `${parts[2]}.${parts[3]}`;
  }
  return generateClientId();
}

/**
 * Send event to GA4 Measurement Protocol
 */
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
  const url = `${endpoint}?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  const payload = {
    client_id: userData.clientId,
    ...(userData.userId && { user_id: userData.userId }),
    events: [
      {
        name: eventName,
        ...(eventTimestampMicros && { timestamp_micros: eventTimestampMicros }),
        params: {
          ...(params || {}),
          // Add session info if available
          ...(userData.sessionId && { session_id: userData.sessionId }),
          // Engagement time is required for most events
          engagement_time_msec: 100,
        },
      },
    ],
    // User properties can be added here
    ...(userData.ipAddress && {
      user_properties: {
        ip_override: { value: userData.ipAddress },
      },
    }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userData.userAgent && { 'User-Agent': userData.userAgent }),
      },
      body: JSON.stringify(payload),
      signal: signal ?? AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
    });

    if (debug) {
      const debugResponse = await response.json();
      return {
        success: debugResponse.validationMessages?.length === 0,
        debugInfo: debugResponse,
      };
    }

    // Non-debug endpoint returns 204 No Content on success
    if (response.status === 204 || response.ok) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${response.status}` };
  } catch (error) {
    console.error('GA4 Measurement Protocol error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Helper functions for common e-commerce events
 */
export const ga4MeasurementProtocol = {
  /**
   * Track a purchase event
   */
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
  ) => {
    return sendGA4Event(measurementId, apiSecret, 'purchase', userData, {
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
    });
  },

  /**
   * Track begin checkout event
   */
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
  ) => {
    return sendGA4Event(measurementId, apiSecret, 'begin_checkout', userData, {
      value,
      currency,
      items: products.map((p) => ({
        item_id: p.id,
        item_name: p.name,
        price: p.price,
        quantity: p.quantity,
      })),
    });
  },

  /**
   * Track add to cart event
   */
  addToCart: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    currency: string
  ) => {
    return sendGA4Event(measurementId, apiSecret, 'add_to_cart', userData, {
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
    });
  },

  /**
   * Track view item event
   */
  viewItem: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    productId: string,
    productName: string,
    price: number,
    currency: string,
    category?: string
  ) => {
    return sendGA4Event(measurementId, apiSecret, 'view_item', userData, {
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
    });
  },

  /**
   * Track search event
   */
  search: (
    measurementId: string,
    apiSecret: string,
    userData: GA4UserData,
    searchTerm: string
  ) => {
    return sendGA4Event(measurementId, apiSecret, 'search', userData, {
      search_term: searchTerm,
    });
  },
};
