import crypto from 'node:crypto';
import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';

/**
 * Snapchat Conversions API (Server-Side)
 *
 * Server-side event tracking for Snapchat Ads.
 * Provides more accurate attribution by bypassing ad blockers.
 *
 * @see https://marketingapi.snapchat.com/docs/conversion.html
 */

const SNAP_CAPI_URL = 'https://tr.snapchat.com/v2/conversion';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

export type SnapchatEventName =
  | 'PAGE_VIEW'
  | 'VIEW_CONTENT'
  | 'ADD_CART'
  | 'START_CHECKOUT'
  | 'ADD_BILLING'
  | 'PURCHASE'
  | 'SEARCH'
  | 'SIGN_UP'
  | 'ADD_TO_WISHLIST';

export interface SnapchatUserData {
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
  clickId?: string; // Snapchat click ID from URL param 'ScCid'
}

export interface SnapchatEventData {
  price?: number;
  currency?: string;
  transactionId?: string;
  itemIds?: string[];
  searchString?: string;
  numberOfItems?: number;
}

/**
 * Hash data using SHA-256 (required by Snapchat)
 */
function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

/**
 * Send event to Snapchat Conversions API
 */
export async function sendSnapchatEvent(
  pixelId: string,
  accessToken: string,
  eventName: SnapchatEventName,
  userData: SnapchatUserData,
  eventData?: SnapchatEventData,
  eventId?: string,
  signal?: AbortSignal,
  eventTime?: number
): Promise<{ success: boolean; error?: string; httpStatus?: number }> {
  if (!pixelId || !accessToken) {
    return { success: false, error: 'Missing pixel ID or access token' };
  }

  const timestamp = eventTime ?? Math.floor(Date.now() / 1000);
  const eventConversionType = eventName === 'PURCHASE' ? 'OFFLINE' : 'WEB';

  // Build hashed user data
  const hashedData: Record<string, string> = {};
  if (userData.email) hashedData.hashed_email = hashData(userData.email);
  if (userData.phone)
    hashedData.hashed_phone_number = hashData(
      userData.phone.replace(/[^\d]/g, '')
    );
  if (userData.ipAddress)
    hashedData.hashed_ip_address = hashData(userData.ipAddress);

  const payload = {
    pixel_id: pixelId,
    timestamp: timestamp.toString(),
    event_type: eventName,
    event_conversion_type: eventConversionType,
    event_tag:
      eventId || `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...hashedData,
    ...(userData.userAgent && { user_agent: userData.userAgent }),
    ...(userData.clickId && { click_id: userData.clickId }),
    ...(eventData?.price !== undefined && {
      price: eventData.price.toString(),
    }),
    ...(eventData?.currency && { currency: eventData.currency }),
    ...(eventData?.transactionId && {
      transaction_id: eventData.transactionId,
    }),
    ...(eventData?.itemIds && { item_ids: JSON.stringify(eventData.itemIds) }),
    ...(eventData?.searchString && { search_string: eventData.searchString }),
    ...(eventData?.numberOfItems !== undefined && {
      number_items: eventData.numberOfItems.toString(),
    }),
  };

  try {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(SNAP_CAPI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: requestSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const safeError = sanitizeEventErrorMessage(errorText, [
        pixelId,
        accessToken,
      ]);
      console.error(
        sanitizeEventErrorMessage('Snapchat CAPI error:', [
          pixelId,
          accessToken,
        ]),
        safeError
      );
      return {
        success: false,
        error: safeError,
        httpStatus: response.status,
      };
    }

    return { success: true };
  } catch (error) {
    const safeError = sanitizeEventErrorMessage(
      error instanceof Error ? error.message : 'Network error',
      [pixelId, accessToken]
    );
    console.error(
      sanitizeEventErrorMessage('Snapchat CAPI request failed:', [
        pixelId,
        accessToken,
      ]),
      safeError
    );
    return {
      success: false,
      error: safeError,
    };
  }
}

/**
 * Helper functions for common e-commerce events
 */
export const snapchatCAPI = {
  purchase: (
    pixelId: string,
    accessToken: string,
    userData: SnapchatUserData,
    transactionId: string,
    value: number,
    currency: string,
    productIds: string[],
    eventId?: string,
    signal?: AbortSignal,
    eventTime?: number
  ) => {
    return sendSnapchatEvent(
      pixelId,
      accessToken,
      'PURCHASE',
      userData,
      {
        price: value,
        currency,
        transactionId,
        itemIds: productIds,
        numberOfItems: productIds.length,
      },
      eventId,
      signal,
      eventTime
    );
  },

  startCheckout: (
    pixelId: string,
    accessToken: string,
    userData: SnapchatUserData,
    value: number,
    currency: string,
    productIds: string[],
    eventId?: string,
    signal?: AbortSignal,
    eventTime?: number
  ) => {
    return sendSnapchatEvent(
      pixelId,
      accessToken,
      'START_CHECKOUT',
      userData,
      {
        price: value,
        currency,
        itemIds: productIds,
      },
      eventId,
      signal,
      eventTime
    );
  },

  addToCart: (
    pixelId: string,
    accessToken: string,
    userData: SnapchatUserData,
    productId: string,
    price: number,
    currency: string,
    eventId?: string,
    signal?: AbortSignal,
    eventTime?: number
  ) => {
    return sendSnapchatEvent(
      pixelId,
      accessToken,
      'ADD_CART',
      userData,
      {
        price,
        currency,
        itemIds: [productId],
      },
      eventId,
      signal,
      eventTime
    );
  },
};
