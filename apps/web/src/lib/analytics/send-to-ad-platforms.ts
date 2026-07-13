/**
 * Shared CAPI Fan-out Utility
 *
 * Sends conversion events to all configured ad platforms (Facebook CAPI,
 * TikTok Events API, Snapchat CAPI). Extracted from the conversion route
 * so both /api/events and /api/analytics/conversion can share the same logic.
 *
 * This function is designed to run inside Next.js `after()` — it never throws
 * and logs all results internally.
 */

import { createClient } from '@supabase/supabase-js';
import {
  type AnalyticsPlatformConfig,
  fetchAnalyticsPlatformConfig,
} from '@/lib/analytics/analytics-platform-config';
import { facebookCAPI, sendFacebookCAPIEvent } from '@/lib/facebook-capi';
import { logger } from '@/lib/logger';
import { sendSnapchatEvent, snapchatCAPI } from '@/lib/snapchat-capi';
import {
  type TikTokEventProperties,
  tiktokEventsAPI,
} from '@/lib/tiktok-events-api';

export type AdPlatformTarget = 'facebook' | 'tiktok' | 'snapchat' | 'google';

export interface ConversionEvent {
  merchant_id: string;
  event_type: string; // DB-style: 'purchase', 'begin_checkout', etc.
  event_id: string;
  occurred_at?: string;
  limited_data_use?: boolean;
  user_data: {
    email?: string;
    phone?: string;
    external_id?: string;
    ip?: string;
    ua?: string;
    fbc?: string;
    fbp?: string;
    ttclid?: string;
    ttp?: string;
    sccid?: string;
  };
  custom_data: {
    order_id?: string;
    value?: number;
    currency?: string;
    content_name?: string;
    content_type?: 'product' | 'product_group';
    price?: number;
    search_string?: string;
    url?: string;
    contents?: Array<{
      id: string;
      quantity: number;
      name?: string;
      price?: number;
    }>;
  };
  source: 'web' | 'mobile_app' | 'server';
  targets?: AdPlatformTarget[];
}

export type AdPlatformResults = Partial<
  Record<
    'facebook' | 'tiktok' | 'snapchat',
    { success: boolean; error?: string }
  >
>;

export type AdPlatformDeliveryOptions = {
  signal?: AbortSignal;
};

/** Maps mobile/conversion-style names to DB event_type */
export const CONVERSION_NAME_TO_DB: Record<string, string> = {
  PURCHASE: 'purchase',
  START_CHECKOUT: 'begin_checkout',
  ADD_CART: 'add_to_cart',
  ADD_TO_CART: 'add_to_cart',
  VIEW_CONTENT: 'product_view',
  ADD_PAYMENT_INFO: 'add_payment_info',
  ADD_TO_WISHLIST: 'add_to_wishlist',
  ADD_WISHLIST: 'add_to_wishlist',
  SEARCH: 'search',
  SIGN_UP: 'customer_registered',
  COMPLETE_REGISTRATION: 'customer_registered',
  PLACE_AN_ORDER: 'place_order',
  PLACE_ORDER: 'place_order',
  // Pass-through for already-normalized names
  purchase: 'purchase',
  begin_checkout: 'begin_checkout',
  add_to_cart: 'add_to_cart',
  product_view: 'product_view',
  add_payment_info: 'add_payment_info',
  add_to_wishlist: 'add_to_wishlist',
  search: 'search',
  customer_registered: 'customer_registered',
  place_order: 'place_order',
};

const DB_TO_FACEBOOK: Record<string, string> = {
  purchase: 'Purchase',
  begin_checkout: 'InitiateCheckout',
  add_to_cart: 'AddToCart',
  product_view: 'ViewContent',
  add_payment_info: 'AddPaymentInfo',
  add_to_wishlist: 'AddToWishlist',
  search: 'Search',
  customer_registered: 'CompleteRegistration',
};

const DB_TO_TIKTOK: Record<string, string> = {
  purchase: 'Purchase',
  begin_checkout: 'InitiateCheckout',
  add_to_cart: 'AddToCart',
  product_view: 'ViewContent',
  add_payment_info: 'AddPaymentInfo',
  add_to_wishlist: 'AddToWishlist',
  search: 'Search',
  customer_registered: 'CompleteRegistration',
  place_order: 'PlaceAnOrder',
};

const DB_TO_SNAPCHAT: Record<string, string> = {
  purchase: 'PURCHASE',
  begin_checkout: 'START_CHECKOUT',
  add_to_cart: 'ADD_CART',
  product_view: 'VIEW_CONTENT',
  add_payment_info: 'ADD_BILLING',
  add_to_wishlist: 'ADD_TO_WISHLIST',
  search: 'SEARCH',
  customer_registered: 'SIGN_UP',
};

/** Event types that should be forwarded to ad platforms */
const CONVERSION_EVENT_TYPES = new Set([
  ...Object.keys(DB_TO_FACEBOOK),
  ...Object.keys(DB_TO_TIKTOK),
  ...Object.keys(DB_TO_SNAPCHAT),
]);

export function isConversionEvent(eventType: string): boolean {
  return CONVERSION_EVENT_TYPES.has(eventType);
}

/**
 * Normalize any event name (mobile uppercase or DB lowercase) to DB format.
 * Returns undefined if the event name is not a recognized conversion event.
 */
export function normalizeEventType(eventName: string): string | undefined {
  return CONVERSION_NAME_TO_DB[eventName];
}

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    );
  }
  return adminClient;
}

function toProducts(contents: ConversionEvent['custom_data']['contents']) {
  return (contents || []).map((content) => ({
    id: content.id,
    name: content.name || content.id,
    price: content.price || 0,
    quantity: content.quantity,
  }));
}

function toTikTokProperties(event: ConversionEvent): TikTokEventProperties {
  const contents = event.custom_data.contents || [];
  const firstContent = contents[0];
  const contentIds = contents.map((content) => content.id);
  return {
    value: event.custom_data.value,
    currency: event.custom_data.currency || 'NGN',
    contentId: firstContent?.id,
    contentIds: contentIds.length > 0 ? contentIds : undefined,
    contentName:
      event.custom_data.content_name || firstContent?.name || firstContent?.id,
    contentType: event.custom_data.content_type || 'product',
    price: event.custom_data.price ?? firstContent?.price,
    orderId: event.custom_data.order_id,
    searchString: event.custom_data.search_string,
    url: event.custom_data.url,
    contents:
      contents.length > 0
        ? contents.map((content) => ({
            content_id: content.id,
            content_name: content.name || content.id,
            price: content.price,
            quantity: content.quantity,
          }))
        : undefined,
  };
}

function targetEnabled(
  event: ConversionEvent,
  target: AdPlatformTarget
): boolean {
  return !event.targets || event.targets.includes(target);
}

function occurredAtSeconds(occurredAt: string | undefined): number | undefined {
  const timestamp = occurredAt ? Date.parse(occurredAt) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0
    ? Math.floor(timestamp / 1_000)
    : undefined;
}

async function sendToFacebook(
  config: AnalyticsPlatformConfig,
  event: ConversionEvent,
  fbEventName: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!config.facebook_pixel_id || !config.facebook_capi_token) {
    return { success: false, error: 'not_configured' };
  }

  const fbUserData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    externalId: event.user_data.external_id,
    clientIpAddress: event.user_data.ip,
    clientUserAgent: event.user_data.ua,
    fbc: event.user_data.fbc,
    fbp: event.user_data.fbp,
  };

  const pixelId = config.facebook_pixel_id;
  const token = config.facebook_capi_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];
  const firstContent = contents[0];
  const eventSourceUrl = event.custom_data.url;
  const eventTime = occurredAtSeconds(event.occurred_at);

  switch (fbEventName) {
    case 'Purchase':
      if (value && contents.length > 0) {
        return await facebookCAPI.purchase(
          pixelId,
          token,
          fbUserData,
          event.custom_data.order_id || event.event_id,
          value,
          currency,
          toProducts(contents),
          eventSourceUrl,
          event.event_id,
          event.limited_data_use,
          signal,
          eventTime
        );
      }
      return { success: false, error: 'missing_purchase_data' };

    case 'InitiateCheckout':
      return await facebookCAPI.initiateCheckout(
        pixelId,
        token,
        fbUserData,
        value,
        currency,
        contents,
        eventSourceUrl,
        event.event_id,
        signal,
        eventTime
      );

    case 'AddToCart':
      if (firstContent) {
        return await facebookCAPI.addToCart(
          pixelId,
          token,
          fbUserData,
          firstContent.id,
          firstContent.name || firstContent.id,
          value,
          currency,
          eventSourceUrl,
          event.event_id,
          signal,
          eventTime
        );
      }
      return { success: false, error: 'missing_cart_data' };

    case 'ViewContent':
      if (firstContent) {
        return await facebookCAPI.viewContent(
          pixelId,
          token,
          fbUserData,
          firstContent.id,
          firstContent.name || firstContent.id,
          value,
          currency,
          undefined,
          eventSourceUrl,
          event.event_id,
          signal,
          eventTime
        );
      }
      return { success: false, error: 'missing_content_data' };

    case 'Search':
      if (!event.custom_data.search_string) {
        return { success: false, error: 'missing_search_data' };
      }
      return await sendFacebookCAPIEvent(
        pixelId,
        token,
        'Search',
        fbUserData,
        {
          contentIds: contents.map((content) => content.id),
          currency,
          searchString: event.custom_data.search_string,
          value,
        },
        eventSourceUrl,
        event.event_id,
        undefined,
        signal,
        eventTime
      );

    case 'AddPaymentInfo':
    case 'AddToWishlist':
    case 'CompleteRegistration':
      return await sendFacebookCAPIEvent(
        pixelId,
        token,
        fbEventName,
        fbUserData,
        {
          contentIds: contents.map((content) => content.id),
          contentName:
            event.custom_data.content_name ||
            firstContent?.name ||
            firstContent?.id,
          contentType: event.custom_data.content_type || 'product',
          currency,
          value,
        },
        eventSourceUrl,
        event.event_id,
        undefined,
        signal,
        eventTime
      );

    default:
      return { success: false, error: `unmapped_event: ${fbEventName}` };
  }
}

async function sendToTikTok(
  config: AnalyticsPlatformConfig,
  event: ConversionEvent,
  ttEventName: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!config.tiktok_pixel_id || !config.tiktok_access_token) {
    return { success: false, error: 'not_configured' };
  }

  const ttUserData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    externalId: event.user_data.external_id,
    ipAddress: event.user_data.ip,
    ttclid: event.user_data.ttclid,
    ttp: event.user_data.ttp,
    userAgent: event.user_data.ua,
  };

  const pixelId = config.tiktok_pixel_id;
  const token = config.tiktok_access_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];
  const options = {
    eventId: event.event_id,
    eventTime: event.occurred_at,
    url: event.custom_data.url,
  };
  const properties = toTikTokProperties(event);

  switch (ttEventName) {
    case 'Purchase':
      if (value && event.custom_data.order_id && contents.length > 0) {
        return await tiktokEventsAPI.purchase(
          pixelId,
          token,
          ttUserData,
          event.custom_data.order_id,
          value,
          currency,
          toProducts(contents),
          options,
          signal
        );
      }
      return { success: false, error: 'missing_purchase_data' };

    case 'InitiateCheckout':
      if (contents.length > 0) {
        return await tiktokEventsAPI.initiateCheckout(
          pixelId,
          token,
          ttUserData,
          properties,
          options,
          undefined,
          undefined,
          signal
        );
      }
      return { success: false, error: 'missing_checkout_data' };

    case 'AddToCart':
      if (contents.length > 0) {
        return await tiktokEventsAPI.addToCart(
          pixelId,
          token,
          ttUserData,
          properties,
          options,
          signal
        );
      }
      return { success: false, error: 'missing_cart_data' };

    case 'ViewContent':
      if (contents.length > 0) {
        return await tiktokEventsAPI.viewContent(
          pixelId,
          token,
          ttUserData,
          properties,
          options,
          signal
        );
      }
      return { success: false, error: 'missing_content_data' };

    case 'Search':
      if (!event.custom_data.search_string) {
        return { success: false, error: 'missing_search_data' };
      }
      return await tiktokEventsAPI.search(
        pixelId,
        token,
        ttUserData,
        event.custom_data.search_string,
        options,
        signal
      );

    case 'AddPaymentInfo':
      return await tiktokEventsAPI.addPaymentInfo(
        pixelId,
        token,
        ttUserData,
        properties,
        options,
        signal
      );

    case 'AddToWishlist':
      return await tiktokEventsAPI.addToWishlist(
        pixelId,
        token,
        ttUserData,
        properties,
        options,
        signal
      );

    case 'PlaceAnOrder':
      return await tiktokEventsAPI.placeAnOrder(
        pixelId,
        token,
        ttUserData,
        properties,
        options,
        signal
      );

    case 'CompleteRegistration':
      return await tiktokEventsAPI.completeRegistration(
        pixelId,
        token,
        ttUserData,
        properties,
        options,
        signal
      );

    default:
      return { success: false, error: `unmapped_event: ${ttEventName}` };
  }
}

async function sendToSnapchat(
  config: AnalyticsPlatformConfig,
  event: ConversionEvent,
  snapEventName: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!config.snapchat_pixel_id || !config.snapchat_capi_token) {
    return { success: false, error: 'not_configured' };
  }

  const snapUserData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    ipAddress: event.user_data.ip,
    userAgent: event.user_data.ua,
    clickId: event.user_data.sccid,
  };

  const pixelId = config.snapchat_pixel_id;
  const token = config.snapchat_capi_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];
  const firstContent = contents[0];
  const productIds = contents.map((content) => content.id);
  const eventTime = occurredAtSeconds(event.occurred_at);

  switch (snapEventName) {
    case 'PURCHASE':
      if (value && event.custom_data.order_id && contents.length > 0) {
        return await snapchatCAPI.purchase(
          pixelId,
          token,
          snapUserData,
          event.custom_data.order_id,
          value,
          currency,
          productIds,
          event.event_id,
          signal,
          eventTime
        );
      }
      return { success: false, error: 'missing_purchase_data' };

    case 'START_CHECKOUT':
      if (contents.length > 0) {
        return await snapchatCAPI.startCheckout(
          pixelId,
          token,
          snapUserData,
          value,
          currency,
          productIds,
          event.event_id,
          signal,
          eventTime
        );
      }
      return { success: false, error: 'missing_checkout_data' };

    case 'ADD_CART':
      if (firstContent) {
        return await snapchatCAPI.addToCart(
          pixelId,
          token,
          snapUserData,
          firstContent.id,
          value,
          currency,
          event.event_id,
          signal,
          eventTime
        );
      }
      return { success: false, error: 'missing_cart_data' };

    case 'SEARCH':
      if (!event.custom_data.search_string) {
        return { success: false, error: 'missing_search_data' };
      }
      return await sendSnapchatEvent(
        pixelId,
        token,
        'SEARCH',
        snapUserData,
        {
          currency,
          itemIds: productIds,
          searchString: event.custom_data.search_string,
        },
        event.event_id,
        signal,
        eventTime
      );

    case 'VIEW_CONTENT':
    case 'ADD_BILLING':
    case 'ADD_TO_WISHLIST':
    case 'SIGN_UP':
      return await sendSnapchatEvent(
        pixelId,
        token,
        snapEventName,
        snapUserData,
        {
          currency,
          itemIds: productIds,
          numberOfItems: productIds.length || undefined,
          price: value,
        },
        event.event_id,
        signal,
        eventTime
      );

    default:
      return { success: false, error: `unmapped_event: ${snapEventName}` };
  }
}

/**
 * Send a conversion event to all configured ad platforms.
 *
 * Designed to run inside `after()` — never throws, logs everything internally.
 * Uses `Promise.allSettled` so one platform failure doesn't block others.
 */
export async function sendToAdPlatforms(
  event: ConversionEvent,
  options: AdPlatformDeliveryOptions = {}
): Promise<AdPlatformResults> {
  const config = await fetchAnalyticsPlatformConfig(
    getAdminClient(),
    event.merchant_id
  );

  if (!config) {
    logger.warn({
      message: 'Failed to fetch merchant ad config',
      merchantId: event.merchant_id,
    });
    return {};
  }

  if (config.offline_conversions_enabled === false) {
    logger.info({
      message: 'Offline conversions disabled by merchant',
      merchantId: event.merchant_id,
      eventType: event.event_type,
    });
    return {};
  }

  const jobs: Array<{
    name: keyof AdPlatformResults;
    run: Promise<{ success: boolean; error?: string }>;
  }> = [];
  const fbEvent = DB_TO_FACEBOOK[event.event_type];
  const ttEvent = DB_TO_TIKTOK[event.event_type];
  const snapEvent = DB_TO_SNAPCHAT[event.event_type];

  if (fbEvent && targetEnabled(event, 'facebook')) {
    jobs.push({
      name: 'facebook',
      run: sendToFacebook(config, event, fbEvent, options.signal),
    });
  }
  if (ttEvent && targetEnabled(event, 'tiktok')) {
    jobs.push({
      name: 'tiktok',
      run: sendToTikTok(config, event, ttEvent, options.signal),
    });
  }
  if (snapEvent && targetEnabled(event, 'snapchat')) {
    jobs.push({
      name: 'snapchat',
      run: sendToSnapchat(config, event, snapEvent, options.signal),
    });
  }

  const settled = await Promise.allSettled(jobs.map((job) => job.run));
  const results: AdPlatformResults = {};
  for (const [index, result] of settled.entries()) {
    const platform = jobs[index]?.name;
    if (!platform) continue;
    results[platform] =
      result.status === 'fulfilled'
        ? result.value
        : { success: false, error: 'unhandled_error' };
  }

  const summary = jobs.map((job) => {
    const result = results[job.name];
    if (!result) return `${job.name}:skip`;
    if (result.success) return `${job.name}:ok`;
    if (result.error === 'not_configured' || result.error === 'no_mapping') {
      return `${job.name}:skip`;
    }
    return `${job.name}:fail(${result.error})`;
  });

  logger.info({
    message: 'CAPI fan-out complete',
    eventType: event.event_type,
    eventId: event.event_id,
    source: event.source,
    merchantId: event.merchant_id,
    results: summary,
  });

  return results;
}
