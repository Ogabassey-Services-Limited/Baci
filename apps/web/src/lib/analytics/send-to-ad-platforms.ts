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
import { facebookCAPI } from '@/lib/facebook-capi';
import { logger } from '@/lib/logger';
import { snapchatCAPI } from '@/lib/snapchat-capi';
import { tiktokEventsAPI } from '@/lib/tiktok-events-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversionEvent {
  merchant_id: string;
  event_type: string; // DB-style: 'purchase', 'begin_checkout', etc.
  event_id: string;
  user_data: {
    email?: string;
    phone?: string;
    external_id?: string;
    ip?: string;
    ua?: string;
  };
  custom_data: {
    order_id?: string;
    value?: number;
    currency?: string;
    contents?: Array<{
      id: string;
      quantity: number;
      name?: string;
      price?: number;
    }>;
  };
  source: 'web' | 'mobile_app' | 'server';
}

interface MerchantAdConfig {
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
}

// ---------------------------------------------------------------------------
// Event Name Mapping: DB event_type → platform-specific event names
// ---------------------------------------------------------------------------

/** Maps mobile/conversion-style names to DB event_type */
export const CONVERSION_NAME_TO_DB: Record<string, string> = {
  PURCHASE: 'purchase',
  START_CHECKOUT: 'begin_checkout',
  ADD_CART: 'add_to_cart',
  VIEW_CONTENT: 'product_view',
  SIGN_UP: 'customer_registered',
  // Pass-through for already-normalized names
  purchase: 'purchase',
  begin_checkout: 'begin_checkout',
  add_to_cart: 'add_to_cart',
  product_view: 'product_view',
  customer_registered: 'customer_registered',
};

const DB_TO_FACEBOOK: Record<string, string> = {
  purchase: 'Purchase',
  begin_checkout: 'InitiateCheckout',
  add_to_cart: 'AddToCart',
  product_view: 'ViewContent',
  customer_registered: 'CompleteRegistration',
};

const DB_TO_TIKTOK: Record<string, string> = {
  purchase: 'purchase',
  begin_checkout: 'begin_checkout',
  add_to_cart: 'add_to_cart',
  product_view: 'view_item',
  customer_registered: 'sign_up',
};

const DB_TO_SNAPCHAT: Record<string, string> = {
  purchase: 'purchase',
  begin_checkout: 'begin_checkout',
  add_to_cart: 'add_to_cart',
  product_view: 'view_content',
  customer_registered: 'sign_up',
};

/** Event types that should be forwarded to ad platforms */
const CONVERSION_EVENT_TYPES = new Set(Object.keys(DB_TO_FACEBOOK));

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

// ---------------------------------------------------------------------------
// Lazy admin client (same pattern as /api/events)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Merchant config cache (per-request is fine, this runs in after())
// ---------------------------------------------------------------------------

async function fetchMerchantAdConfig(
  merchantId: string
): Promise<MerchantAdConfig | null> {
  const { data, error } = await getAdminClient()
    .from('merchants')
    .select(
      'facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, snapchat_pixel_id, snapchat_capi_token'
    )
    .eq('id', merchantId)
    .single();

  if (error || !data) {
    logger.warn({
      message: 'Failed to fetch merchant ad config',
      merchantId,
      error,
    });
    return null;
  }
  return data as MerchantAdConfig;
}

// ---------------------------------------------------------------------------
// Platform Senders
// ---------------------------------------------------------------------------

async function sendToFacebook(
  config: MerchantAdConfig,
  event: ConversionEvent,
  fbEventName: string
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
  };

  const pixelId = config.facebook_pixel_id;
  const token = config.facebook_capi_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];

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
          contents.map((c) => ({
            id: c.id,
            name: c.name || c.id,
            quantity: c.quantity,
            price: c.price || 0,
          }))
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
        contents
      );

    case 'AddToCart':
      if (contents[0]) {
        return await facebookCAPI.addToCart(
          pixelId,
          token,
          fbUserData,
          contents[0].id,
          contents[0].name || contents[0].id,
          value,
          currency
        );
      }
      return { success: false, error: 'missing_cart_data' };

    case 'ViewContent':
      if (contents[0]) {
        return await facebookCAPI.viewContent(
          pixelId,
          token,
          fbUserData,
          contents[0].id,
          contents[0].name || contents[0].id,
          value,
          currency
        );
      }
      return { success: false, error: 'missing_content_data' };

    default:
      return { success: false, error: `unmapped_event: ${fbEventName}` };
  }
}

async function sendToTikTok(
  config: MerchantAdConfig,
  event: ConversionEvent,
  ttEventName: string
): Promise<{ success: boolean; error?: string }> {
  if (!config.tiktok_pixel_id || !config.tiktok_access_token) {
    return { success: false, error: 'not_configured' };
  }

  const ttUserData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    externalId: event.user_data.external_id,
    ipAddress: event.user_data.ip,
    userAgent: event.user_data.ua,
  };

  const pixelId = config.tiktok_pixel_id;
  const token = config.tiktok_access_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];

  switch (ttEventName) {
    case 'purchase':
      if (value && event.custom_data.order_id && contents.length > 0) {
        return await tiktokEventsAPI.purchase(
          pixelId,
          token,
          ttUserData,
          event.custom_data.order_id,
          value,
          currency,
          contents.map((c) => ({
            id: c.id,
            name: c.name || c.id,
            quantity: c.quantity,
            price: c.price || 0,
          }))
        );
      }
      return { success: false, error: 'missing_purchase_data' };

    case 'begin_checkout':
      if (contents.length > 0) {
        return await tiktokEventsAPI.initiateCheckout(
          pixelId,
          token,
          ttUserData,
          value,
          currency,
          contents.map((c) => c.id)
        );
      }
      return { success: false, error: 'missing_checkout_data' };

    default:
      return { success: false, error: `unmapped_event: ${ttEventName}` };
  }
}

async function sendToSnapchat(
  config: MerchantAdConfig,
  event: ConversionEvent,
  snapEventName: string
): Promise<{ success: boolean; error?: string }> {
  if (!config.snapchat_pixel_id || !config.snapchat_capi_token) {
    return { success: false, error: 'not_configured' };
  }

  const snapUserData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    ipAddress: event.user_data.ip,
    userAgent: event.user_data.ua,
  };

  const pixelId = config.snapchat_pixel_id;
  const token = config.snapchat_capi_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];

  switch (snapEventName) {
    case 'purchase':
      if (value && event.custom_data.order_id && contents.length > 0) {
        return await snapchatCAPI.purchase(
          pixelId,
          token,
          snapUserData,
          event.custom_data.order_id,
          value,
          currency,
          contents.map((c) => c.id)
        );
      }
      return { success: false, error: 'missing_purchase_data' };

    case 'begin_checkout':
      if (contents.length > 0) {
        return await snapchatCAPI.startCheckout(
          pixelId,
          token,
          snapUserData,
          value,
          currency,
          contents.map((c) => c.id)
        );
      }
      return { success: false, error: 'missing_checkout_data' };

    case 'add_to_cart':
      if (contents[0]) {
        return await snapchatCAPI.addToCart(
          pixelId,
          token,
          snapUserData,
          contents[0].id,
          value,
          currency
        );
      }
      return { success: false, error: 'missing_cart_data' };

    default:
      return { success: false, error: `unmapped_event: ${snapEventName}` };
  }
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Send a conversion event to all configured ad platforms.
 *
 * Designed to run inside `after()` — never throws, logs everything internally.
 * Uses `Promise.allSettled` so one platform failure doesn't block others.
 */
export async function sendToAdPlatforms(event: ConversionEvent): Promise<void> {
  const config = await fetchMerchantAdConfig(event.merchant_id);
  if (!config) return;

  const fbEvent = DB_TO_FACEBOOK[event.event_type];
  const ttEvent = DB_TO_TIKTOK[event.event_type];
  const snapEvent = DB_TO_SNAPCHAT[event.event_type];

  const results = await Promise.allSettled([
    fbEvent
      ? sendToFacebook(config, event, fbEvent)
      : Promise.resolve({ success: false, error: 'no_mapping' }),
    ttEvent
      ? sendToTikTok(config, event, ttEvent)
      : Promise.resolve({ success: false, error: 'no_mapping' }),
    snapEvent
      ? sendToSnapchat(config, event, snapEvent)
      : Promise.resolve({ success: false, error: 'no_mapping' }),
  ]);

  const platforms = ['facebook', 'tiktok', 'snapchat'] as const;
  const summary = platforms.map((name, i) => {
    const r = results[i];
    if (r.status === 'rejected') return `${name}:error`;
    const val = r.value;
    if (val.success) return `${name}:ok`;
    if (val.error === 'not_configured' || val.error === 'no_mapping') {
      return `${name}:skip`;
    }
    return `${name}:fail(${val.error})`;
  });

  logger.info({
    message: 'CAPI fan-out complete',
    eventType: event.event_type,
    eventId: event.event_id,
    source: event.source,
    merchantId: event.merchant_id,
    results: summary,
  });
}
