import crypto from 'node:crypto';
import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';

/**
 * TikTok Events API (Server-Side)
 *
 * Server-side event tracking for TikTok Ads.
 * This bypasses ad blockers and provides more accurate attribution.
 *
 * @see https://business-api.tiktok.com/portal/docs?id=1741601162187777
 */

const TIKTOK_API_URL =
  'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

export type TikTokEventName =
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'PlaceAnOrder'
  | 'Search'
  | 'AddPaymentInfo'
  | 'AddToWishlist'
  | 'CompleteRegistration';

export interface TikTokUserData {
  email?: string;
  phone?: string;
  externalId?: string;
  ipAddress?: string;
  ttclid?: string;
  userAgent?: string;
  ttp?: string;
}

export interface TikTokEventProperties {
  value?: number;
  currency?: string;
  contentId?: string;
  contentIds?: string[];
  contentName?: string;
  contentType?: 'product' | 'product_group';
  price?: number;
  contents?: Array<{
    content_id: string;
    price?: number;
    quantity?: number;
    content_name?: string;
  }>;
  query?: string;
  searchString?: string;
  orderId?: string;
  url?: string;
}

export interface TikTokEventOptions {
  eventId?: string;
  eventTime?: Date | number | string;
  testEventCode?: string;
  url?: string;
}

type TikTokContentInput = NonNullable<
  TikTokEventProperties['contents']
>[number];

const MILLISECOND_TIMESTAMP_THRESHOLD = 1_000_000_000_000;

function compactRecord<T extends Record<string, unknown>>(
  record: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/**
 * Hash data using SHA-256 (required by TikTok)
 */
function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

function normalizeUnixSeconds(value: number): number {
  return Math.floor(
    value > MILLISECOND_TIMESTAMP_THRESHOLD ? value / 1000 : value
  );
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function toEventTime(eventTime: Date | number | string | undefined): number {
  if (eventTime instanceof Date) {
    const timestamp = eventTime.getTime();
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return currentUnixSeconds();
    }
    return Math.floor(timestamp / 1000);
  }

  if (typeof eventTime === 'number') {
    if (!Number.isFinite(eventTime) || eventTime <= 0) {
      return currentUnixSeconds();
    }
    return normalizeUnixSeconds(eventTime);
  }

  if (typeof eventTime === 'string') {
    const trimmedTime = eventTime.trim();
    if (!trimmedTime) {
      return currentUnixSeconds();
    }

    const numericTime = Number(trimmedTime);
    if (Number.isFinite(numericTime)) {
      if (numericTime <= 0) {
        return currentUnixSeconds();
      }
      return normalizeUnixSeconds(numericTime);
    }

    const parsedTime = Date.parse(trimmedTime);
    if (Number.isFinite(parsedTime)) {
      return Math.floor(parsedTime / 1000);
    }
  }

  return currentUnixSeconds();
}

/**
 * Send event to TikTok Events API
 */
export async function sendTikTokEvent(
  pixelId: string,
  accessToken: string,
  eventName: TikTokEventName,
  userData: TikTokUserData,
  properties?: TikTokEventProperties,
  eventOptions?: TikTokEventOptions | string,
  testEventCode?: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string; httpStatus?: number }> {
  if (!pixelId || !accessToken) {
    return { success: false, error: 'Missing pixel ID or access token' };
  }

  const options =
    typeof eventOptions === 'string'
      ? { eventId: eventOptions, testEventCode }
      : eventOptions;

  // Build user data with hashing
  const user: Record<string, string | undefined> = {};
  if (userData.email) user.email = hashData(userData.email);
  if (userData.phone)
    user.phone = hashData(userData.phone.replace(/[^\d+]/g, ''));
  if (userData.externalId) user.external_id = hashData(userData.externalId);
  if (userData.ipAddress) user.ip = userData.ipAddress;
  if (userData.userAgent) user.user_agent = userData.userAgent;
  if (userData.ttclid) user.ttclid = userData.ttclid;
  if (userData.ttp) user.ttp = userData.ttp;

  // Build properties
  const eventProperties: Record<string, unknown> = {};
  if (properties?.value !== undefined) eventProperties.value = properties.value;
  if (properties?.currency) eventProperties.currency = properties.currency;
  if (properties?.contentId) eventProperties.content_id = properties.contentId;
  if (properties?.contentIds)
    eventProperties.content_ids = properties.contentIds;
  if (properties?.contentName)
    eventProperties.content_name = properties.contentName;
  if (properties?.contentType)
    eventProperties.content_type = properties.contentType;
  if (properties?.price !== undefined) eventProperties.price = properties.price;
  if (properties?.contents) eventProperties.contents = properties.contents;
  if (properties?.query) eventProperties.search_string = properties.query;
  if (properties?.searchString)
    eventProperties.search_string = properties.searchString;
  if (properties?.orderId) eventProperties.order_id = properties.orderId;

  const pageUrl = options?.url || properties?.url;

  const payload = {
    event: eventName,
    event_id:
      options?.eventId ||
      `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    event_time: toEventTime(options?.eventTime),
    user: compactRecord(user),
    page: compactRecord({
      url: pageUrl,
    }),
    properties: eventProperties,
  };

  try {
    const response = await fetch(TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: pixelId,
        data: [payload],
        ...(options?.testEventCode
          ? { test_event_code: options.testEventCode }
          : {}),
      }),
      signal: signal ?? AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(
        'TikTok Events API error:',
        sanitizeEventErrorMessage(JSON.stringify(errorData))
      );
      return {
        success: false,
        error:
          errorData &&
          typeof errorData === 'object' &&
          'message' in errorData &&
          typeof errorData.message === 'string'
            ? errorData.message
            : 'Unknown error',
        httpStatus: response.status,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Network error';
    console.error(
      'TikTok Events API request failed:',
      sanitizeEventErrorMessage(errorMessage)
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Helper functions for common e-commerce events
 */
export const tiktokEventsAPI = {
  purchase: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    orderId: string,
    value: number,
    currency: string,
    products: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    const contents = products.map((p) => ({
      content_id: p.id,
      content_name: p.name,
      price: p.price,
      quantity: p.quantity,
    }));
    const firstProduct = products[0];

    return sendTikTokEvent(
      pixelId,
      accessToken,
      'Purchase',
      userData,
      {
        value,
        currency,
        orderId,
        contentId: firstProduct?.id,
        contentName: firstProduct?.name,
        contentType: 'product',
        price: firstProduct?.price,
        contentIds: products.map((p) => p.id),
        contents,
      },
      options,
      undefined,
      signal
    );
  },

  initiateCheckout: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    valueOrProperties: number | TikTokEventProperties,
    currencyOrOptions?: string | TikTokEventOptions,
    productIds?: string[],
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    const properties =
      typeof valueOrProperties === 'number'
        ? {
            value: valueOrProperties,
            currency:
              typeof currencyOrOptions === 'string'
                ? currencyOrOptions
                : undefined,
            contentIds: productIds,
          }
        : valueOrProperties;
    const finalOptions =
      typeof currencyOrOptions === 'object' ? currencyOrOptions : options;

    return sendTikTokEvent(
      pixelId,
      accessToken,
      'InitiateCheckout',
      userData,
      properties,
      finalOptions,
      undefined,
      signal
    );
  },

  viewContent: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'ViewContent',
      userData,
      withFirstContent(properties),
      options,
      undefined,
      signal
    );
  },

  addToCart: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'AddToCart',
      userData,
      withFirstContent(properties),
      options,
      undefined,
      signal
    );
  },

  addToWishlist: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'AddToWishlist',
      userData,
      withFirstContent(properties),
      options,
      undefined,
      signal
    );
  },

  addPaymentInfo: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties = {},
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'AddPaymentInfo',
      userData,
      withFirstContent(properties),
      options,
      undefined,
      signal
    );
  },

  placeAnOrder: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'PlaceAnOrder',
      userData,
      withFirstContent(properties),
      options,
      undefined,
      signal
    );
  },

  completeRegistration: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties = {},
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'CompleteRegistration',
      userData,
      properties,
      options,
      undefined,
      signal
    );
  },

  search: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    searchString: string,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'Search',
      userData,
      {
        searchString,
        url: options?.url,
      },
      options,
      undefined,
      signal
    );
  },
};

function withFirstContent(
  properties: TikTokEventProperties
): TikTokEventProperties {
  const firstContent: TikTokContentInput | undefined = properties.contents?.[0];
  return {
    ...properties,
    contentId: properties.contentId || firstContent?.content_id,
    contentName: properties.contentName || firstContent?.content_name,
    contentType: properties.contentType || 'product',
    price: properties.price ?? firstContent?.price,
  };
}
