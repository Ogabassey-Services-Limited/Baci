/**
 * Unified Ad Tracking Service - 2026 Best Practices
 *
 * SERVER-SIDE FIRST APPROACH
 * ==========================
 * All conversion events are sent to our server which then forwards to:
 * - Meta/Facebook Conversions API (CAPI)
 * - TikTok Events API
 * - Snapchat Conversions API
 * - Google Ads Enhanced Conversions
 *
 * Why server-side first?
 * 1. iOS 14.5+ ATT compliance - bypasses tracking restrictions
 * 2. No ad blockers - server-side can't be blocked
 * 3. Better data quality - single source of truth
 * 4. Event deduplication - use event_id to prevent duplicates
 * 5. PII hashing done on server - more secure
 *
 * Client-side SDKs (Facebook, TikTok) are used as BACKUP only
 * and include the same event_id for deduplication.
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
 */

import { createLogger } from '@/lib/logger';
const log = createLogger('AdTracking');

// Firebase Analytics removed due to native conflict. Using PostHog and Server-side CAPI instead.
const _analytics = () => ({
  setUserId: async (_: string) => { },
  resetAnalyticsData: async () => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logViewItem: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logAddToCart: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logBeginCheckout: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logPurchase: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logAddPaymentInfo: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logSearch: async (_: any) => { },
  logAppOpen: async () => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logScreenView: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logSignUp: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logLogin: async (_: any) => { },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logEvent: async (_: string, __?: any) => { },
});

import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import {
  AEMReporterIOS,
  AppEventsLogger,
  Settings as FBSettings,
} from 'react-native-fbsdk-next';
import TikTokBusiness from 'react-native-tiktok-business';

// Import PostHog analytics (product analytics, not ad tracking)
import {
  trackAddToCart as posthogAddToCart,
  identifyUser as posthogIdentify,
  trackOrderCompleted as posthogOrderCompleted,
  trackProductViewed as posthogProductViewed,
  resetUser as posthogReset,
  trackSearch as posthogSearch,
  trackEvent as posthogTrack,
} from './analytics';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FB_APP_ID = Constants.expoConfig?.extra?.facebookAppId || '';
const FB_CLIENT_TOKEN = Constants.expoConfig?.extra?.facebookClientToken || '';
const TIKTOK_APP_ID = Constants.expoConfig?.extra?.tiktokAppId || '';
const TIKTOK_ACCESS_TOKEN =
  Constants.expoConfig?.extra?.tiktokAccessToken || '';
const API_URL =
  Constants.expoConfig?.extra?.apiUrl || 'https://ogabassey.com/api';

let isTrackingAllowed = false;
let isInitialized = false;
let isTikTokInitialized = false;

// Store user data for server-side tracking
let cachedUserData: {
  userId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
} = {};

// =============================================================================
// EVENT ID GENERATION (Critical for deduplication)
// =============================================================================

/**
 * Generate a unique event ID for deduplication
 * This ID is sent to BOTH client-side SDKs and server-side APIs
 * so duplicate events can be detected and merged
 */
async function generateEventId(): Promise<string> {
  const timestamp = Date.now().toString(36);
  const randomBytes = await Crypto.getRandomBytesAsync(8);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${timestamp}_${randomHex}`;
}

/**
 * Synchronous event ID generation (fallback)
 */
function generateEventIdSync(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${random}`;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize tracking SDKs
 * Client-side SDKs are initialized for BACKUP tracking only
 * Primary tracking goes through server-side CAPI
 */
export async function initAdTracking(): Promise<void> {
  if (isInitialized) return;

  try {
    // 1. Check ATT permission on iOS
    if (Platform.OS === 'ios') {
      const { status } = await getTrackingPermissionsAsync();
      isTrackingAllowed = status === 'granted';
      FBSettings.setAdvertiserTrackingEnabled(isTrackingAllowed);
      // AEMReporterIOS.configure() - removed, not available in current SDK version
    } else {
      isTrackingAllowed = true;
    }

    // 2. Initialize Facebook SDK (backup tracking)
    if (FB_APP_ID && FB_CLIENT_TOKEN) {
      FBSettings.initializeSDK();
      log.info('Facebook SDK initialized (backup)');
    }

    // 3. Firebase Analytics is auto-initialized

    // 4. Initialize TikTok SDK (backup tracking)
    if (TIKTOK_APP_ID && TIKTOK_ACCESS_TOKEN) {
      try {
        await TikTokBusiness.init({
          appId: TIKTOK_APP_ID,
          tiktokAppId: TIKTOK_APP_ID,
          accessToken: TIKTOK_ACCESS_TOKEN,
          debug: __DEV__,
        });
        isTikTokInitialized = true;
        log.info('TikTok SDK initialized (backup)');
      } catch (ttError) {
        log.warn('TikTok SDK init error:', ttError);
      }
    }

    isInitialized = true;
    log.info(
      'Initialized. Server-side tracking enabled. ATT:',
      isTrackingAllowed
    );
  } catch (error) {
    log.error('Initialization error:', error);
  }
}

/**
 * Request App Tracking Transparency permission
 * Returns the permission status string
 */
export async function requestTrackingPermission(): Promise<string> {
  if (Platform.OS !== 'ios') return 'granted';

  try {
    const { status } = await requestTrackingPermissionsAsync();
    isTrackingAllowed = status === 'granted';
    FBSettings.setAdvertiserTrackingEnabled(isTrackingAllowed);
    return status;
  } catch (error) {
    log.error('ATT request error:', error);
    return 'denied';
  }
}

/**
 * Check if tracking is allowed
 */
export function isTrackingEnabled(): boolean {
  return isTrackingAllowed;
}

// =============================================================================
// USER IDENTIFICATION
// =============================================================================

/**
 * Identify user - stores data for server-side tracking
 */
export async function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<void> {
  // Cache for server-side tracking
  cachedUserData = {
    userId,
    email: properties?.email,
    phone: properties?.phone,
    firstName: properties?.firstName,
    lastName: properties?.lastName,
  };

  // PostHog (product analytics)
  posthogIdentify(userId, {
    email: properties?.email,
    name:
      properties?.firstName && properties?.lastName
        ? `${properties.firstName} ${properties.lastName}`
        : undefined,
    phone: properties?.phone,
  });

  // Firebase (Removed)
  // await analytics().setUserId(userId);

  // Facebook (only if ATT allowed)
  if (isTrackingAllowed && properties?.email) {
    AppEventsLogger.setUserData({
      email: properties.email,
      firstName: properties.firstName,
      lastName: properties.lastName,
      phone: properties.phone,
    });
  }
}

/**
 * Reset user identity on logout
 */
export async function resetUserIdentity(): Promise<void> {
  cachedUserData = {};
  posthogReset();
  // No-op for Firebase
  // await analytics().resetAnalyticsData();
  AppEventsLogger.clearUserID();
}

// =============================================================================
// SERVER-SIDE CONVERSION API (PRIMARY TRACKING)
// =============================================================================

interface ConversionData {
  userId?: string;
  email?: string;
  phone?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  items?: Array<{
    id: string;
    quantity: number;
    name?: string;
    price?: number;
  }>;
}

/**
 * Send conversion event to server which forwards to ALL platforms
 * This is the PRIMARY tracking method - all platforms receive the same event_id
 */
async function sendServerConversion(
  eventName: string,
  eventId: string,
  data: ConversionData
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/analytics/conversion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId, // Critical for deduplication
        event_time: Math.floor(Date.now() / 1000),
        event_source: 'mobile_app',
        platform: Platform.OS,
        user_data: {
          em: data.email || cachedUserData.email,
          ph: data.phone || cachedUserData.phone,
          external_id: data.userId || cachedUserData.userId,
          fn: cachedUserData.firstName,
          ln: cachedUserData.lastName,
        },
        custom_data: {
          order_id: data.orderId,
          value: data.value,
          currency: data.currency || 'NGN',
          contents: data.items,
        },
        // All platforms receive the event with same event_id
        targets: ['facebook', 'tiktok', 'snapchat', 'google'],
      }),
    });

    if (__DEV__) {
      const result = await response.json();
      log.debug(`[Server] ${eventName} sent:`, result);
    }
  } catch (error) {
    // Log but don't throw - analytics should never break the app
    log.warn('Server conversion error:', error);
  }
}

// =============================================================================
// CLIENT-SIDE BACKUP TRACKING
// Uses same event_id for deduplication with server-side events
// =============================================================================

/**
 * Send backup event to client-side SDKs with same event_id
 * Platforms will deduplicate based on event_id
 */
function sendClientBackup(
  _eventName: string,
  eventId: string,
  fbEvent: string,
  ttEvent: string | null,
  value: number,
  currency: string,
  params: Record<string, string | number>
): void {
  // Facebook (backup) - include event_id for deduplication
  AppEventsLogger.logEvent(fbEvent, value, {
    ...params,
    _eventId: eventId, // Facebook uses _eventId for dedup
  });

  // AEM for iOS (privacy-preserving backup)
  if (Platform.OS === 'ios') {
    AEMReporterIOS.logAEMEvent(fbEvent, value, currency, params);
  }

  // TikTok (backup) - Cast to any due to SDK type mismatch
  if (isTikTokInitialized && ttEvent) {
    (
      TikTokBusiness.trackEvent as (
        name: string,
        params?: Record<string, unknown>
      ) => void
    )(ttEvent, {
      ...params,
      event_id: eventId, // TikTok uses event_id for dedup
    });
  }
}

// =============================================================================
// E-COMMERCE EVENTS
// =============================================================================

/**
 * Track product viewed
 */
export async function trackProductViewed(product: {
  id: string;
  name: string;
  price: number;
  currency?: string;
  category?: string;
}): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = product.currency || 'NGN';

  // 1. PostHog (product analytics - not ad tracking)
  posthogProductViewed({
    id: product.id,
    name: product.name,
    price: product.price,
    currency,
    category: product.category,
  });

  // Firebase (Removed)
  /*
  await analytics().logViewItem({
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        price: product.price,
        item_category: product.category,
      },
    ],
    currency,
    value: product.price,
  });
  */

  // 3. SERVER-SIDE (PRIMARY) - sends to Facebook, TikTok, Snapchat, Google
  sendServerConversion('VIEW_CONTENT', eventId, {
    value: product.price,
    currency,
    items: [
      { id: product.id, quantity: 1, name: product.name, price: product.price },
    ],
  });

  // 4. CLIENT-SIDE (BACKUP) - with same event_id for deduplication
  sendClientBackup(
    'VIEW_CONTENT',
    eventId,
    'fb_mobile_content_view',
    'ViewContent',
    product.price,
    currency,
    {
      fb_content_id: product.id,
      fb_content_type: 'product',
      fb_currency: currency,
      content_id: product.id,
      content_name: product.name,
    }
  );
}

/**
 * Track add to cart
 */
export async function trackAddToCart(
  product: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    currency?: string;
    category?: string;
  },
  cartTotal?: number
): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = product.currency || 'NGN';
  const value = product.price * product.quantity;

  // 1. PostHog
  posthogAddToCart(
    {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      currency,
      category: product.category,
    },
    cartTotal
  );

  // Firebase (Removed)
  /*
  await analytics().logAddToCart({
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        price: product.price,
        quantity: product.quantity,
        item_category: product.category,
      },
    ],
    currency,
    value,
  });
  */

  // 3. SERVER-SIDE (PRIMARY)
  sendServerConversion('ADD_CART', eventId, {
    value,
    currency,
    items: [
      {
        id: product.id,
        quantity: product.quantity,
        name: product.name,
        price: product.price,
      },
    ],
  });

  // 4. CLIENT-SIDE (BACKUP)
  sendClientBackup(
    'ADD_CART',
    eventId,
    'fb_mobile_add_to_cart',
    'AddToCart',
    value,
    currency,
    {
      fb_content_id: product.id,
      fb_content_type: 'product',
      fb_currency: currency,
      fb_num_items: product.quantity,
      content_id: product.id,
      quantity: product.quantity,
    }
  );
}

/**
 * Track checkout initiated
 */
export async function trackCheckoutStarted(checkout: {
  itemCount: number;
  subtotal: number;
  currency?: string;
  items?: Array<{ id: string; name: string; price: number; quantity: number }>;
}): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = checkout.currency || 'NGN';

  // Firebase (Removed)
  /*
  await analytics().logBeginCheckout({
    items:
      checkout.items?.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      })) || [],
    currency,
    value: checkout.subtotal,
  });
  */

  // 2. SERVER-SIDE (PRIMARY)
  sendServerConversion('START_CHECKOUT', eventId, {
    value: checkout.subtotal,
    currency,
    items: checkout.items?.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      name: i.name,
      price: i.price,
    })),
  });

  // 3. CLIENT-SIDE (BACKUP)
  sendClientBackup(
    'START_CHECKOUT',
    eventId,
    'fb_mobile_initiated_checkout',
    'InitiateCheckout',
    checkout.subtotal,
    currency,
    {
      fb_currency: currency,
      fb_num_items: checkout.itemCount,
      quantity: checkout.itemCount,
    }
  );
}

/**
 * Track purchase completed - MOST CRITICAL EVENT
 * Uses async event_id generation for maximum uniqueness
 */
export async function trackPurchase(order: {
  orderId: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  shipping?: number;
  tax?: number;
  currency?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  paymentMethod?: string;
  couponCode?: string;
  email?: string;
  phone?: string;
  userId?: string;
}): Promise<void> {
  // Use async generation for purchase - most important event
  const eventId = await generateEventId();
  const currency = order.currency || 'NGN';
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

  // 1. PostHog (product analytics)
  posthogOrderCompleted({
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    total: order.total,
    subtotal: order.subtotal,
    shipping: order.shipping,
    tax: order.tax,
    currency,
    itemCount: order.items.length,
    paymentMethod: order.paymentMethod,
    couponCode: order.couponCode,
  });

  // Firebase (Removed)
  /*
  await analytics().logPurchase({
    transaction_id: order.orderId,
    affiliation: 'Ogabassey Mobile App',
    value: order.total,
    currency,
    tax: order.tax,
    shipping: order.shipping,
    coupon: order.couponCode,
    items: order.items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
      item_category: item.category,
    })),
  });
  */

  // 3. SERVER-SIDE (PRIMARY) - this is the authoritative source
  sendServerConversion('PURCHASE', eventId, {
    orderId: order.orderId,
    value: order.total,
    currency,
    email: order.email,
    phone: order.phone,
    userId: order.userId,
    items: order.items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      name: i.name,
      price: i.price,
    })),
  });

  // 4. CLIENT-SIDE (BACKUP) - with same event_id
  // Facebook
  AppEventsLogger.logPurchase(order.total, currency, {
    fb_order_id: order.orderId,
    fb_content_type: 'product',
    fb_content_id: JSON.stringify(order.items.map((i) => i.id)),
    fb_num_items: totalItems,
    _eventId: eventId,
  });

  // AEM for iOS
  if (Platform.OS === 'ios') {
    AEMReporterIOS.logAEMEvent('fb_mobile_purchase', order.total, currency, {
      fb_order_id: order.orderId,
      fb_num_items: order.items.length,
    });
  }

  // TikTok - Cast to any due to SDK type mismatch
  if (isTikTokInitialized) {
    (
      TikTokBusiness.trackEvent as (
        name: string,
        params?: Record<string, unknown>
      ) => void
    )('CompletePayment', {
      content_type: 'product',
      contents: order.items.map((item) => ({
        content_id: item.id,
        content_name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      quantity: totalItems,
      value: order.total,
      currency,
      event_id: eventId,
    });
  }

  log.info(`Purchase tracked: ${order.orderId} - ${order.total} ${currency}`);
}

/**
 * Track payment info added
 */
export async function trackPaymentInfoAdded(
  _paymentMethod: string
): Promise<void> {
  const eventId = generateEventIdSync();

  // await analytics().logAddPaymentInfo({ payment_type: paymentMethod });

  sendServerConversion('ADD_PAYMENT_INFO', eventId, {});

  AppEventsLogger.logEvent('fb_mobile_add_payment_info', { _eventId: eventId });

  if (Platform.OS === 'ios') {
    AEMReporterIOS.logAEMEvent('fb_mobile_add_payment_info', 0, 'NGN', {});
  }
}

// =============================================================================
// SEARCH & DISCOVERY
// =============================================================================

/**
 * Track search
 */
export async function trackSearch(
  query: string,
  resultCount: number
): Promise<void> {
  const eventId = generateEventIdSync();

  posthogSearch(query, resultCount);

  // await analytics().logSearch({ search_term: query });

  sendServerConversion('SEARCH', eventId, {});

  AppEventsLogger.logEvent('fb_mobile_search', {
    fb_search_string: query,
    _eventId: eventId,
  });

  if (isTikTokInitialized) {
    (
      TikTokBusiness.trackEvent as (
        name: string,
        params?: Record<string, unknown>
      ) => void
    )('Search', {
      query,
      event_id: eventId,
    });
  }
}

// =============================================================================
// APP LIFECYCLE EVENTS
// =============================================================================

/**
 * Track app open
 */
export async function trackAppOpen(): Promise<void> {
  // await analytics().logAppOpen();
  AppEventsLogger.logEvent('fb_mobile_activate_app');
}

/**
 * Track screen view
 */
export async function trackScreenView(
  _screenName: string,
  _screenClass?: string
): Promise<void> {
  /*
  await analytics().logScreenView({
    screen_name: screenName,
    screen_class: screenClass || screenName,
  });
  */
}

/**
 * Track signup completed
 */
export async function trackSignup(
  method: string,
  userData?: { email?: string; phone?: string; userId?: string }
): Promise<void> {
  const eventId = generateEventIdSync();

  // await analytics().logSignUp({ method });

  sendServerConversion('SIGN_UP', eventId, {
    email: userData?.email,
    phone: userData?.phone,
    userId: userData?.userId,
  });

  AppEventsLogger.logEvent('fb_mobile_complete_registration', {
    fb_registration_method: method,
    _eventId: eventId,
  });

  if (Platform.OS === 'ios') {
    AEMReporterIOS.logAEMEvent('fb_mobile_complete_registration', 0, 'NGN', {
      fb_registration_method: method,
    });
  }

  if (isTikTokInitialized) {
    (
      TikTokBusiness.trackEvent as (
        name: string,
        params?: Record<string, unknown>
      ) => void
    )('CompleteRegistration', {
      registration_method: method,
      event_id: eventId,
    });
  }
}

/**
 * Track login
 */
export async function trackLogin(_method: string): Promise<void> {
  // await analytics().logLogin({ method });
}

// =============================================================================
// CUSTOM EVENTS
// =============================================================================

/**
 * Log custom event to all platforms
 */
export async function trackCustomEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  const eventId = generateEventIdSync();

  posthogTrack(eventName, params);
  // await analytics().logEvent(eventName, params);

  if (params) {
    const fbParams: Record<string, string> = { _eventId: eventId };
    Object.entries(params).forEach(([key, value]) => {
      fbParams[key] = String(value);
    });
    AppEventsLogger.logEvent(eventName, fbParams);
  } else {
    AppEventsLogger.logEvent(eventName, { _eventId: eventId });
  }

  if (isTikTokInitialized) {
    (
      TikTokBusiness.trackEvent as (
        name: string,
        params?: Record<string, unknown>
      ) => void
    )(eventName, { ...params, event_id: eventId });
  }
}
