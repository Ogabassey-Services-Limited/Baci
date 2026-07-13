import crypto from 'node:crypto';

/**
 * Facebook Conversions API (CAPI) Implementation
 *
 * Server-side event tracking for Meta/Facebook ads.
 * This bypasses ad blockers and provides more accurate attribution.
 *
 * Benefits:
 * - Not blocked by ad blockers
 * - More accurate conversion tracking
 * - Better data for optimization
 * - Required for some ad features
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const FB_API_VERSION = 'v21.0';
const FB_GRAPH_API = 'https://graph.facebook.com';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

// Event names supported by Facebook CAPI
export type FacebookEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'Lead'
  | 'CompleteRegistration';

// User data for matching (will be hashed before sending)
export interface FacebookUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalId?: string; // Your own user ID
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string; // Facebook click ID from cookie
  fbp?: string; // Facebook browser ID from cookie
}

// Custom data for e-commerce events
export interface FacebookCustomData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: 'product' | 'product_group';
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  numItems?: number;
  orderId?: string;
  searchString?: string;
  status?: string;
}

interface FacebookEvent {
  event_name: FacebookEventName;
  event_time: number;
  event_id: string;
  event_source_url?: string;
  action_source:
    | 'website'
    | 'app'
    | 'email'
    | 'phone_call'
    | 'chat'
    | 'physical_store'
    | 'other';
  user_data: Record<string, string | undefined>;
  custom_data?: Record<string, unknown>;
  opt_out?: boolean;
}

interface CAPIResponse {
  events_received: number;
  messages: string[];
  fbtrace_id: string;
}

/**
 * Hash data using SHA-256 (required by Facebook)
 */
function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

/**
 * Normalize and hash phone number
 */
function hashPhone(phone: string): string {
  // Remove all non-numeric characters except leading +
  const normalized = phone.replace(/[^\d+]/g, '');
  return hashData(normalized);
}

/**
 * Build hashed user data object for Facebook
 */
function buildUserData(
  userData: FacebookUserData
): Record<string, string | undefined> {
  const hashed: Record<string, string | undefined> = {};

  if (userData.email) {
    hashed.em = hashData(userData.email);
  }
  if (userData.phone) {
    hashed.ph = hashPhone(userData.phone);
  }
  if (userData.firstName) {
    hashed.fn = hashData(userData.firstName);
  }
  if (userData.lastName) {
    hashed.ln = hashData(userData.lastName);
  }
  if (userData.city) {
    hashed.ct = hashData(userData.city);
  }
  if (userData.state) {
    hashed.st = hashData(userData.state);
  }
  if (userData.zipCode) {
    hashed.zp = hashData(userData.zipCode);
  }
  if (userData.country) {
    hashed.country = hashData(userData.country);
  }
  if (userData.externalId) {
    hashed.external_id = hashData(userData.externalId);
  }

  // These are not hashed
  if (userData.clientIpAddress) {
    hashed.client_ip_address = userData.clientIpAddress;
  }
  if (userData.clientUserAgent) {
    hashed.client_user_agent = userData.clientUserAgent;
  }
  if (userData.fbc) {
    hashed.fbc = userData.fbc;
  }
  if (userData.fbp) {
    hashed.fbp = userData.fbp;
  }

  return hashed;
}

/**
 * Build custom data object for Facebook
 */
function buildCustomData(
  customData: FacebookCustomData
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (customData.value !== undefined) data.value = customData.value;
  if (customData.currency) data.currency = customData.currency;
  if (customData.contentName) data.content_name = customData.contentName;
  if (customData.contentCategory)
    data.content_category = customData.contentCategory;
  if (customData.contentIds) data.content_ids = customData.contentIds;
  if (customData.contentType) data.content_type = customData.contentType;
  if (customData.contents) data.contents = customData.contents;
  if (customData.numItems !== undefined) data.num_items = customData.numItems;
  if (customData.orderId) data.order_id = customData.orderId;
  if (customData.searchString) data.search_string = customData.searchString;
  if (customData.status) data.status = customData.status;

  return data;
}

/**
 * Generate a unique event ID for deduplication
 */
export function generateEventId(): string {
  return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Send event to Facebook Conversions API
 * @param limitedDataUse - When true, enables Limited Data Use (LDU) mode for CCPA compliance
 *                         This restricts how Facebook can use the data for California users
 */
export async function sendFacebookCAPIEvent(
  pixelId: string,
  accessToken: string,
  eventName: FacebookEventName,
  userData: FacebookUserData,
  customData?: FacebookCustomData,
  eventSourceUrl?: string,
  eventId?: string,
  limitedDataUse?: boolean,
  signal?: AbortSignal,
  eventTime?: number
): Promise<{ success: boolean; response?: CAPIResponse; error?: string }> {
  if (!pixelId || !accessToken) {
    return { success: false, error: 'Missing pixel ID or access token' };
  }

  const event: FacebookEvent = {
    event_name: eventName,
    event_time: eventTime ?? Math.floor(Date.now() / 1000),
    event_id: eventId || generateEventId(),
    event_source_url: eventSourceUrl,
    action_source: 'website',
    user_data: buildUserData(userData),
    custom_data: customData ? buildCustomData(customData) : undefined,
    // LDU mode: opt_out restricts data processing for CCPA compliance
    opt_out: limitedDataUse,
  };

  // Build request body
  const requestBody: Record<string, unknown> = {
    data: [event],
    access_token: accessToken,
  };

  // Enable test mode in development
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.FB_TEST_EVENT_CODE
  ) {
    requestBody.test_event_code = process.env.FB_TEST_EVENT_CODE;
  }

  // Add Data Processing Options for LDU (Limited Data Use) - CCPA compliance
  // This is in addition to opt_out and provides more granular control
  if (limitedDataUse) {
    // data_processing_options: ['LDU'] enables Limited Data Use
    // data_processing_options_country: 1 = USA
    // data_processing_options_state: 1000 = California
    requestBody.data_processing_options = ['LDU'];
    requestBody.data_processing_options_country = 1;
    requestBody.data_processing_options_state = 1000;
  }

  try {
    const response = await fetch(
      `${FB_GRAPH_API}/${FB_API_VERSION}/${pixelId}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: signal ?? AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      // Sanitize error logging to avoid exposing sensitive data
      if (errorData?.error) {
        const { message, type, code, fbtrace_id } = errorData.error;
        console.error(
          `Facebook CAPI error${type ? ` [${type}]` : ''}${code ? ` (code ${code})` : ''}: ${
            message || 'Unknown error'
          }${fbtrace_id ? ` [fbtrace_id: ${fbtrace_id}]` : ''}`
        );
      } else {
        console.error('Facebook CAPI error: Unknown error structure');
      }
      return {
        success: false,
        error: errorData.error?.message || 'Unknown error',
      };
    }

    const result = (await response.json()) as CAPIResponse;
    return { success: true, response: result };
  } catch (error) {
    // Sanitize error logging to avoid exposing sensitive data like tokens
    if (error instanceof Error) {
      console.error('Facebook CAPI request failed:', error.message);
    } else {
      console.error('Facebook CAPI request failed: Network error');
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Helper functions for common e-commerce events
 */
export const facebookCAPI = {
  /**
   * Track a purchase event (server-side)
   * @param eventId - Optional event ID for deduplication with client-side Pixel
   * @param limitedDataUse - Set to true for California users (CCPA/LDU compliance)
   */
  purchase: (
    pixelId: string,
    accessToken: string,
    userData: FacebookUserData,
    orderId: string,
    value: number,
    currency: string,
    products: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
    }>,
    eventSourceUrl?: string,
    eventId?: string,
    limitedDataUse?: boolean,
    signal?: AbortSignal
  ) => {
    return sendFacebookCAPIEvent(
      pixelId,
      accessToken,
      'Purchase',
      userData,
      {
        value,
        currency,
        orderId,
        contentType: 'product',
        contentIds: products.map((p) => p.id),
        contents: products.map((p) => ({
          id: p.id,
          quantity: p.quantity,
          item_price: p.price,
        })),
        numItems: products.reduce((sum, p) => sum + p.quantity, 0),
      },
      eventSourceUrl,
      eventId,
      limitedDataUse,
      signal
    );
  },

  /**
   * Track initiate checkout (server-side)
   */
  initiateCheckout: (
    pixelId: string,
    accessToken: string,
    userData: FacebookUserData,
    value: number,
    currency: string,
    products: Array<{ id: string; quantity: number }>,
    eventSourceUrl?: string,
    eventId?: string,
    signal?: AbortSignal
  ) => {
    return sendFacebookCAPIEvent(
      pixelId,
      accessToken,
      'InitiateCheckout',
      userData,
      {
        value,
        currency,
        contentType: 'product',
        contentIds: products.map((p) => p.id),
        numItems: products.reduce((sum, p) => sum + p.quantity, 0),
      },
      eventSourceUrl,
      eventId,
      undefined,
      signal
    );
  },

  /**
   * Track add to cart (server-side)
   */
  addToCart: (
    pixelId: string,
    accessToken: string,
    userData: FacebookUserData,
    productId: string,
    productName: string,
    value: number,
    currency: string,
    eventSourceUrl?: string,
    eventId?: string,
    signal?: AbortSignal
  ) => {
    return sendFacebookCAPIEvent(
      pixelId,
      accessToken,
      'AddToCart',
      userData,
      {
        value,
        currency,
        contentName: productName,
        contentType: 'product',
        contentIds: [productId],
      },
      eventSourceUrl,
      eventId,
      undefined,
      signal
    );
  },

  /**
   * Track view content (server-side)
   */
  viewContent: (
    pixelId: string,
    accessToken: string,
    userData: FacebookUserData,
    productId: string,
    productName: string,
    value: number,
    currency: string,
    category?: string,
    eventSourceUrl?: string,
    eventId?: string,
    signal?: AbortSignal
  ) => {
    return sendFacebookCAPIEvent(
      pixelId,
      accessToken,
      'ViewContent',
      userData,
      {
        value,
        currency,
        contentName: productName,
        contentCategory: category,
        contentType: 'product',
        contentIds: [productId],
      },
      eventSourceUrl,
      eventId,
      undefined,
      signal
    );
  },
};
