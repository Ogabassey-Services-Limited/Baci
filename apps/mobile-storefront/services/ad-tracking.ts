import { createLogger } from '@/lib/logger';

const log = createLogger('AdTracking');

// Firebase Analytics removed due to native conflict. Using PostHog and Server-side CAPI instead.
const _analytics = () => ({
  setUserId: async (_: string) => {},
  resetAnalyticsData: async () => {},
  logViewItem: async (_: unknown) => {},
  logAddToCart: async (_: unknown) => {},
  logBeginCheckout: async (_: unknown) => {},
  logPurchase: async (_: unknown) => {},
  logAddPaymentInfo: async (_: unknown) => {},
  logSearch: async (_: unknown) => {},
  logAppOpen: async () => {},
  logScreenView: async (_: unknown) => {},
  logSignUp: async (_: unknown) => {},
  logLogin: async (_: unknown) => {},
  logEvent: async (_: string, __?: unknown) => {},
});

import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import {
  getTrackingPermissionStatus,
  requestTrackingPermissionStatus,
} from '@/lib/tracking-transparency';
import { buildTikTokCommerceEventParams } from './tiktok-commerce-event-data';
import {
  type AEMReporterIOSLike,
  type AppEventsLoggerLike,
  type FBSettingsLike,
  loadAdTrackingNativeModules,
  type TikTokBusinessLike,
} from './ad-tracking-native-modules';
import { toTikTokEventData } from './tiktok-event-data';

let FBSettings: FBSettingsLike | null = null;
let AppEventsLogger: AppEventsLoggerLike | null = null;
let AEMReporterIOS: AEMReporterIOSLike | null = null;
let TikTokBusiness: TikTokBusinessLike | null = null;

const loadNativeModules = async () => {
  const modules = await loadAdTrackingNativeModules();
  FBSettings = modules.FBSettings;
  AppEventsLogger = modules.AppEventsLogger;
  AEMReporterIOS = modules.AEMReporterIOS;
  TikTokBusiness = modules.TikTokBusiness;
};

loadNativeModules();

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
const TIKTOK_BUSINESS_CONFIG = Constants.expoConfig?.extra?.tiktokBusiness as
  | { isConfigured?: boolean; iosTikTokAppId?: string | null }
  | undefined;
const IS_TIKTOK_BUSINESS_CONFIGURED = Boolean(
  TIKTOK_BUSINESS_CONFIG?.isConfigured
);
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

let cachedMerchantId: string | null = null;

/**
 * Set the merchant ID for analytics attribution.
 * Call this once when the storefront loads.
 */
export function setMerchantId(merchantId: string): void {
  cachedMerchantId = merchantId;
}

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
  const cryptoUuid =
    typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : null;
  const random =
    typeof cryptoUuid === 'string' && cryptoUuid.length > 0
      ? cryptoUuid.replace(/-/g, '').substring(0, 10)
      : Math.random().toString(36).slice(2, 12).padEnd(10, '0');
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

  // Ensure modules are loaded
  if (Platform.OS !== 'web' && (!FBSettings || !TikTokBusiness)) {
    await loadNativeModules();
  }

  try {
    // 1. Check ATT permission on iOS
    if (Platform.OS === 'ios') {
      const { status } = await getTrackingPermissionStatus();
      isTrackingAllowed = status === 'granted';
      if (FBSettings) {
        FBSettings.setAdvertiserTrackingEnabled(isTrackingAllowed);
      }
    } else {
      isTrackingAllowed = true;
    }

    // 2. Initialize Facebook SDK (backup tracking)
    if (FB_APP_ID && FB_CLIENT_TOKEN && FBSettings) {
      FBSettings.initializeSDK();
      log.info('Facebook SDK initialized (backup)');
    }

    // 3. TikTok SDK initializes natively from app.config plugin values.
    if (IS_TIKTOK_BUSINESS_CONFIGURED && TikTokBusiness) {
      isTikTokInitialized = Boolean(
        TikTokBusiness.initialize?.() || TikTokBusiness.isInitialized?.()
      );
      if (isTikTokInitialized) {
        log.info('TikTok SDK initialized (backup)');
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
    const { status } = await requestTrackingPermissionStatus();
    isTrackingAllowed = status === 'granted';
    if (FBSettings) {
      FBSettings.setAdvertiserTrackingEnabled(isTrackingAllowed);
    }
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
  if (isTrackingAllowed && properties?.email && AppEventsLogger) {
    AppEventsLogger.setUserData({
      email: properties.email,
      firstName: properties.firstName,
      lastName: properties.lastName,
      phone: properties.phone,
    });
  }

  if (isTrackingAllowed && isTikTokInitialized && TikTokBusiness?.identify) {
    TikTokBusiness.identify(
      userId,
      undefined,
      properties?.phone,
      properties?.email
    );
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
  if (AppEventsLogger) {
    AppEventsLogger.clearUserID();
  }
  if (TikTokBusiness?.logout) {
    TikTokBusiness.logout();
  }
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
        // merchant_id enables correct DB logging & multi-tenant support
        ...(cachedMerchantId && { merchant_id: cachedMerchantId }),
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

    // M33 fix: Always consume response body to prevent resource leak.
    // In dev mode, parse as JSON for logging. In production, drain the body.
    if (__DEV__) {
      const result = await response.json();
      log.debug(`[Server] ${eventName} sent:`, result);
    } else {
      await response.text();
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
  params: Record<string, unknown>,
  tikTokParams: Record<string, unknown> = params
): void {
  // Facebook (backup) - include event_id for deduplication
  if (AppEventsLogger) {
    AppEventsLogger.logEvent(fbEvent, value, {
      ...params,
      _eventId: eventId, // Facebook uses _eventId for dedup
    });
  }

  // AEM for iOS (privacy-preserving backup)
  if (Platform.OS === 'ios' && AEMReporterIOS) {
    AEMReporterIOS.logAEMEvent(fbEvent, value, currency, params);
  }

  // TikTok (backup)
  if (isTikTokInitialized && ttEvent && TikTokBusiness) {
    TikTokBusiness.trackEvent(
      ttEvent,
      eventId,
      toTikTokEventData(tikTokParams)
    );
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
  brand?: string;
  description?: string;
}): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = product.currency || 'NGN';
  const tikTokParams = buildTikTokCommerceEventParams({
    contentId: product.id,
    contentName: product.name,
    currency,
    description: product.description,
    value: product.price,
    items: [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        category: product.category,
        brand: product.brand,
      },
    ],
  });

  // 1. PostHog (product analytics - not ad tracking)
  posthogProductViewed({
    id: product.id,
    name: product.name,
    price: product.price,
    currency,
    category: product.category,
  });

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
    },
    tikTokParams
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
    brand?: string;
  },
  cartTotal?: number
): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = product.currency || 'NGN';
  const value = product.price * product.quantity;
  const tikTokParams = buildTikTokCommerceEventParams({
    contentId: product.id,
    contentName: product.name,
    currency,
    value,
    items: [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        category: product.category,
        brand: product.brand,
      },
    ],
  });

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
    },
    tikTokParams
  );
}

/**
 * Track checkout initiated
 */
export async function trackCheckoutStarted(checkout: {
  itemCount: number;
  subtotal: number;
  currency?: string;
  items?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
    brand?: string;
  }>;
}): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = checkout.currency || 'NGN';
  const tikTokParams = buildTikTokCommerceEventParams({
    currency,
    value: checkout.subtotal,
    quantity: checkout.itemCount,
    items: checkout.items,
  });

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
    'Checkout',
    checkout.subtotal,
    currency,
    {
      fb_currency: currency,
      fb_num_items: checkout.itemCount,
    },
    tikTokParams
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
    brand?: string;
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
  const tikTokParams = buildTikTokCommerceEventParams({
    currency,
    value: order.total,
    quantity: totalItems,
    items: order.items,
    extra: {
      order_id: order.orderId,
    },
  });

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
  if (AppEventsLogger) {
    AppEventsLogger.logPurchase(order.total, currency, {
      fb_order_id: order.orderId,
      fb_content_type: 'product',
      fb_content_id: JSON.stringify(order.items.map((i) => i.id)),
      fb_num_items: totalItems,
      _eventId: eventId,
    });
  }

  // AEM for iOS
  if (Platform.OS === 'ios' && AEMReporterIOS) {
    AEMReporterIOS.logAEMEvent('fb_mobile_purchase', order.total, currency, {
      fb_order_id: order.orderId,
      fb_num_items: order.items.length,
    });
  }

  // TikTok
  if (isTikTokInitialized && TikTokBusiness) {
    TikTokBusiness.trackEvent(
      'Purchase',
      eventId,
      toTikTokEventData(tikTokParams)
    );
  }

  log.info(`Purchase tracked: ${order.orderId} - ${order.total} ${currency}`);
}

/**
 * Track payment info added
 */
export async function trackPaymentInfoAdded(
  paymentMethod: string
): Promise<void> {
  const eventId = generateEventIdSync();

  // await analytics().logAddPaymentInfo({ payment_type: paymentMethod });

  sendServerConversion('ADD_PAYMENT_INFO', eventId, {});

  if (AppEventsLogger) {
    AppEventsLogger.logEvent('fb_mobile_add_payment_info', {
      _eventId: eventId,
    });
  }

  if (Platform.OS === 'ios' && AEMReporterIOS) {
    AEMReporterIOS.logAEMEvent('fb_mobile_add_payment_info', 0, 'NGN', {});
  }

  if (isTikTokInitialized && TikTokBusiness) {
    TikTokBusiness.trackEvent(
      'AddPaymentInfo',
      eventId,
      toTikTokEventData({
        payment_method: paymentMethod,
        currency: 'NGN',
      })
    );
  }
}

/**
 * Track product added to wishlist
 */
export async function trackAddToWishlist(product: {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
}): Promise<void> {
  const eventId = generateEventIdSync();
  const currency = product.currency || 'NGN';
  const tikTokParams = buildTikTokCommerceEventParams({
    contentId: product.id,
    contentName: product.name,
    currency,
    value: product.price,
    items: [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        category: product.category,
        brand: product.brand,
      },
    ],
  });

  posthogTrack('Wishlist Item Added', {
    product_id: product.id,
    product_name: product.name,
    price: product.price,
    currency,
    category: product.category,
    brand: product.brand,
  });

  if (isTikTokInitialized && TikTokBusiness) {
    TikTokBusiness.trackEvent(
      'AddToWishlist',
      eventId,
      toTikTokEventData(tikTokParams)
    );
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

  if (AppEventsLogger) {
    AppEventsLogger.logEvent('fb_mobile_search', {
      fb_search_string: query,
      _eventId: eventId,
    });
  }

  if (isTikTokInitialized && TikTokBusiness) {
    TikTokBusiness.trackEvent(
      'Search',
      eventId,
      toTikTokEventData({
        query,
      })
    );
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
  if (AppEventsLogger) {
    AppEventsLogger.logEvent('fb_mobile_activate_app');
  }
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

  if (AppEventsLogger) {
    AppEventsLogger.logEvent('fb_mobile_complete_registration', {
      fb_registration_method: method,
      _eventId: eventId,
    });
  }

  if (Platform.OS === 'ios' && AEMReporterIOS) {
    AEMReporterIOS.logAEMEvent('fb_mobile_complete_registration', 0, 'NGN', {
      fb_registration_method: method,
    });
  }

  if (isTikTokInitialized && TikTokBusiness) {
    TikTokBusiness.trackEvent(
      'Registration',
      eventId,
      toTikTokEventData({
        registration_method: method,
      })
    );
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

  if (AppEventsLogger) {
    if (params) {
      const fbParams: Record<string, string> = { _eventId: eventId };
      Object.entries(params).forEach(([key, value]) => {
        fbParams[key] = String(value);
      });
      AppEventsLogger.logEvent(eventName, fbParams);
    } else {
      AppEventsLogger.logEvent(eventName, { _eventId: eventId });
    }
  }

  if (isTikTokInitialized && TikTokBusiness) {
    TikTokBusiness.trackEvent(eventName, eventId, toTikTokEventData(params));
  }
}
