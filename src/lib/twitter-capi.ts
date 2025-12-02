import crypto from 'node:crypto';

/**
 * Twitter/X Conversions API (Server-Side)
 *
 * Server-side event tracking for Twitter Ads.
 * Provides more accurate attribution by bypassing ad blockers.
 *
 * @see https://developer.twitter.com/en/docs/twitter-ads-api/measurement/api-reference/conversions
 */

const TWITTER_CAPI_URL =
  'https://ads-api.twitter.com/12/measurement/conversions';

export type TwitterEventName =
  | 'PAGE_VIEW'
  | 'VIEW_CONTENT'
  | 'ADD_TO_CART'
  | 'INITIATE_CHECKOUT'
  | 'ADD_PAYMENT_INFO'
  | 'PURCHASE'
  | 'SEARCH'
  | 'COMPLETE_REGISTRATION'
  | 'ADD_TO_WISHLIST';

export interface TwitterUserData {
  email?: string;
  phone?: string;
  twitterClickId?: string; // twclid from URL
  ipAddress?: string;
  userAgent?: string;
}

export interface TwitterEventData {
  value?: number;
  currency?: string;
  orderId?: string;
  contentIds?: string[];
  contentName?: string;
  contentType?: string;
  numItems?: number;
  searchString?: string;
}

/**
 * Hash data using SHA-256 (required by Twitter)
 */
function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

/**
 * Send event to Twitter Conversions API
 *
 * Note: Twitter CAPI requires OAuth 1.0a authentication.
 * You'll need to set up Twitter Ads API access.
 */
export async function sendTwitterEvent(
  pixelId: string,
  oauthToken: string,
  _oauthTokenSecret: string,
  _consumerKey: string,
  _consumerSecret: string,
  _eventName: TwitterEventName,
  userData: TwitterUserData,
  eventData?: TwitterEventData,
  eventId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!pixelId || !oauthToken) {
    return { success: false, error: 'Missing credentials' };
  }

  // Build identifiers
  const identifiers: Array<{
    hashed_email?: string;
    hashed_phone_number?: string;
    twclid?: string;
  }> = [];

  if (userData.email) {
    identifiers.push({ hashed_email: hashData(userData.email) });
  }
  if (userData.phone) {
    identifiers.push({
      hashed_phone_number: hashData(userData.phone.replace(/[^\d]/g, '')),
    });
  }
  if (userData.twitterClickId) {
    identifiers.push({ twclid: userData.twitterClickId });
  }

  const conversion = {
    conversion_time: new Date().toISOString(),
    event_id:
      eventId || `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    identifiers,
    conversion_id: eventData?.orderId,
    ...(eventData?.value !== undefined && {
      value: eventData.value.toString(),
    }),
    ...(eventData?.currency && { currency: eventData.currency }),
    ...(eventData?.numItems !== undefined && {
      number_items: eventData.numItems,
    }),
    ...(eventData?.contentIds && {
      contents: eventData.contentIds.map((id) => ({ content_id: id })),
    }),
  };

  // Note: Full OAuth 1.0a implementation required for production
  // This is a simplified version - in production, use a library like 'oauth-1.0a'
  const payload = {
    conversions: [conversion],
  };

  try {
    // In production, you'd need to sign this request with OAuth 1.0a
    // For now, we'll use Bearer token auth if available
    const response = await fetch(`${TWITTER_CAPI_URL}/${pixelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oauthToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Twitter CAPI error:', errorData);
      return { success: false, error: errorData.detail || 'Unknown error' };
    }

    return { success: true };
  } catch (error) {
    console.error('Twitter CAPI request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Helper functions for common e-commerce events
 *
 * Note: Twitter CAPI has complex OAuth requirements.
 * For simpler implementation, rely on the client-side pixel
 * and use CAPI only for high-value conversions like purchases.
 */
export const twitterCAPI = {
  purchase: async (
    pixelId: string,
    oauthToken: string,
    oauthTokenSecret: string,
    consumerKey: string,
    consumerSecret: string,
    userData: TwitterUserData,
    orderId: string,
    value: number,
    currency: string,
    productIds: string[]
  ) => {
    return sendTwitterEvent(
      pixelId,
      oauthToken,
      oauthTokenSecret,
      consumerKey,
      consumerSecret,
      'PURCHASE',
      userData,
      {
        value,
        currency,
        orderId,
        contentIds: productIds,
        numItems: productIds.length,
      }
    );
  },
};

export default twitterCAPI;
