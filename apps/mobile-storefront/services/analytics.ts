/**
 * Analytics Service - 2026 Best Practices
 * Uses PostHog for product analytics, feature flags, and session recordings
 *
 * @see https://posthog.com/docs/libraries/react-native
 */

import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

import { createLogger } from '@/lib/logger';
const log = createLogger('Analytics');

// PostHog configuration
const POSTHOG_API_KEY = Constants.expoConfig?.extra?.posthogApiKey || '';
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost || 'https://us.i.posthog.com';

// Initialize PostHog client
let posthogClient: PostHog | null = null;

/**
 * Initialize PostHog analytics
 * Call this in app/_layout.tsx on app start
 */
export async function initAnalytics(): Promise<void> {
  if (!POSTHOG_API_KEY) {
    log.warn('PostHog API key not configured');
    return;
  }

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // 2026 PostHog SDK: Enable automatic app lifecycle tracking
      captureAppLifecycleEvents: true,
      // Session recording (if enabled in PostHog dashboard)
      enableSessionReplay: true,
      sessionReplayConfig: {
        // Mask all text inputs by default for privacy
        maskAllTextInputs: true,
        // Mask all images by default (can be adjusted)
        maskAllImages: false,
        // Capture network requests
        captureNetworkTelemetry: true,
      },
      // Flush events every 30 seconds or after 20 events
      flushAt: 20,
      flushInterval: 30000,
    });

    log.info('PostHog initialized');
  } catch (error) {
    log.error('Failed to initialize PostHog:', error);
  }
}

/**
 * Get PostHog client instance
 */
export function getPostHog(): PostHog | null {
  return posthogClient;
}

// =============================================================================
// USER IDENTIFICATION
// =============================================================================

/**
 * Identify a user with their properties
 * Call this after user login
 */
export function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    phone?: string;
    merchantId?: string;
    loyaltyTier?: string;
    loyaltyPoints?: number;
    createdAt?: string;
  }
): void {
  if (!posthogClient) return;

  posthogClient.identify(userId, {
    ...properties,
    $set_once: {
      first_seen: new Date().toISOString(),
    },
  });
}

/**
 * Reset user identity (on logout)
 */
export function resetUser(): void {
  if (!posthogClient) return;
  posthogClient.reset();
}

/**
 * Update user properties without changing identity
 */
export function setUserProperties(
  properties: Record<string, string | number | boolean | null>
): void {
  if (!posthogClient) return;
  posthogClient.capture('$set', { $set: properties });
}

// =============================================================================
// EVENT TRACKING
// =============================================================================

/**
 * Track a custom event
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (!posthogClient) return;

  posthogClient.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track screen view
 */
export function trackScreen(
  screenName: string,
  properties?: Record<string, unknown>
): void {
  if (!posthogClient) return;

  posthogClient.screen(screenName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// E-COMMERCE EVENTS (Standard PostHog e-commerce schema)
// =============================================================================

/**
 * Track product viewed
 */
export function trackProductViewed(product: {
  id: string;
  name: string;
  price: number;
  currency?: string;
  category?: string;
  brand?: string;
  slug?: string;
}): void {
  trackEvent('Product Viewed', {
    product_id: product.id,
    product_name: product.name,
    price: product.price,
    currency: product.currency || 'NGN',
    category: product.category,
    brand: product.brand,
    slug: product.slug,
  });
}

/**
 * Track product added to cart
 */
export function trackAddToCart(
  product: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    currency?: string;
    category?: string;
  },
  cartValue?: number
): void {
  trackEvent('Product Added', {
    product_id: product.id,
    product_name: product.name,
    price: product.price,
    quantity: product.quantity,
    currency: product.currency || 'NGN',
    category: product.category,
    cart_value: cartValue,
  });
}

/**
 * Track product removed from cart
 */
export function trackRemoveFromCart(product: {
  id: string;
  name: string;
  price: number;
  quantity: number;
}): void {
  trackEvent('Product Removed', {
    product_id: product.id,
    product_name: product.name,
    price: product.price,
    quantity: product.quantity,
  });
}

/**
 * Track checkout started
 */
export function trackCheckoutStarted(checkout: {
  cartId?: string;
  itemCount: number;
  subtotal: number;
  currency?: string;
}): void {
  trackEvent('Checkout Started', {
    cart_id: checkout.cartId,
    item_count: checkout.itemCount,
    subtotal: checkout.subtotal,
    currency: checkout.currency || 'NGN',
  });
}

/**
 * Track checkout step completed
 */
export function trackCheckoutStep(
  step: 'shipping_info' | 'payment_method' | 'review',
  properties?: Record<string, unknown>
): void {
  trackEvent('Checkout Step Completed', {
    step,
    ...properties,
  });
}

/**
 * Track order completed
 */
export function trackOrderCompleted(order: {
  orderId: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  shipping?: number;
  tax?: number;
  currency?: string;
  itemCount: number;
  paymentMethod?: string;
  couponCode?: string;
}): void {
  trackEvent('Order Completed', {
    order_id: order.orderId,
    order_number: order.orderNumber,
    total: order.total,
    subtotal: order.subtotal,
    shipping: order.shipping,
    tax: order.tax,
    currency: order.currency || 'NGN',
    item_count: order.itemCount,
    payment_method: order.paymentMethod,
    coupon_code: order.couponCode,
  });
}

/**
 * Track payment failed
 */
export function trackPaymentFailed(reason: string, orderId?: string): void {
  trackEvent('Payment Failed', {
    reason,
    order_id: orderId,
  });
}

// =============================================================================
// SEARCH & DISCOVERY EVENTS
// =============================================================================

/**
 * Track search performed
 */
export function trackSearch(
  query: string,
  resultCount: number,
  filters?: Record<string, unknown>
): void {
  trackEvent('Products Searched', {
    query,
    result_count: resultCount,
    filters,
  });
}

/**
 * Track category viewed
 */
export function trackCategoryViewed(
  categoryName: string,
  categorySlug: string,
  productCount?: number
): void {
  trackEvent('Category Viewed', {
    category_name: categoryName,
    category_slug: categorySlug,
    product_count: productCount,
  });
}

// =============================================================================
// USER ENGAGEMENT EVENTS
// =============================================================================

/**
 * Track wishlist action
 */
export function trackWishlistAction(
  action: 'added' | 'removed',
  product: { id: string; name: string }
): void {
  trackEvent(`Wishlist Item ${action === 'added' ? 'Added' : 'Removed'}`, {
    product_id: product.id,
    product_name: product.name,
  });
}

/**
 * Track share action
 */
export function trackShare(
  contentType: 'product' | 'category' | 'order',
  contentId: string,
  method?: string
): void {
  trackEvent('Content Shared', {
    content_type: contentType,
    content_id: contentId,
    share_method: method,
  });
}

/**
 * Track notification interaction
 */
export function trackNotificationInteraction(
  action: 'received' | 'opened' | 'dismissed',
  notificationType: string,
  notificationId?: string
): void {
  trackEvent('Notification Interaction', {
    action,
    notification_type: notificationType,
    notification_id: notificationId,
  });
}

/**
 * Track app review prompt
 */
export function trackAppReviewPrompt(
  action: 'shown' | 'accepted' | 'declined' | 'later'
): void {
  trackEvent('App Review Prompt', { action });
}

// =============================================================================
// FEATURE FLAGS
// =============================================================================

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  if (!posthogClient) return false;

  try {
    const value = await posthogClient.isFeatureEnabled(flagKey);
    return value === true;
  } catch {
    return false;
  }
}

/**
 * Get feature flag value (for multivariate flags)
 */
export async function getFeatureFlagValue(
  flagKey: string
): Promise<string | boolean | undefined> {
  if (!posthogClient) return undefined;

  try {
    return await posthogClient.getFeatureFlag(flagKey);
  } catch {
    return undefined;
  }
}

/**
 * Get all feature flags for current user
 */
export async function reloadFeatureFlags(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.reloadFeatureFlags();
  } catch (error) {
    log.error('Failed to reload feature flags:', error);
  }
}

// =============================================================================
// TIMING & PERFORMANCE
// =============================================================================

/**
 * Track a timed event (e.g., page load time)
 */
export function trackTiming(
  category: string,
  variable: string,
  durationMs: number,
  label?: string
): void {
  trackEvent('Timing', {
    timing_category: category,
    timing_variable: variable,
    timing_value: durationMs,
    timing_label: label,
  });
}

// =============================================================================
// ERROR TRACKING
// =============================================================================

/**
 * Track an error
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  context?: Record<string, unknown>
): void {
  trackEvent('Error', {
    error_type: errorType,
    error_message: errorMessage,
    ...context,
  });
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Flush pending events and shutdown
 */
export async function shutdownAnalytics(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.flush();
    await posthogClient.shutdown();
    posthogClient = null;
  } catch (error) {
    log.error('Error during shutdown:', error);
  }
}
