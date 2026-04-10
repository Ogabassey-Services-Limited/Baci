/**
 * Analytics Hook - 2025 Best Practices
 *
 * Provides easy access to tracking functions in React components.
 *
 * TRACKING ARCHITECTURE:
 * =======================
 * 1. All events go to SERVER-SIDE CAPI first (primary source)
 * 2. Client-side SDKs are backup with same event_id for deduplication
 * 3. Platforms automatically deduplicate using event_id
 *
 * PLATFORMS:
 * - PostHog (product analytics)
 * - Firebase/Google Ads
 * - Meta/Facebook CAPI
 * - TikTok Events API
 * - Snapchat CAPI
 */

import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import {
  identifyUser,
  isTrackingEnabled,
  requestTrackingPermission,
  resetUserIdentity,
  setMerchantId,
  trackAddToCart,
  trackCheckoutStarted,
  trackCustomEvent,
  trackPaymentInfoAdded,
  trackProductViewed,
  trackPurchase,
  trackScreenView,
  trackSearch,
  trackSignup,
} from '@/services/ad-tracking';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/auth-store';

interface Product {
  id: string;
  name: string;
  price: number;
  currency?: string;
  category?: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
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
  // User data for server-side tracking
  email?: string;
  phone?: string;
  userId?: string;
}

export function useAnalytics() {
  const pathname = usePathname();
  const { user, customer, merchantId } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      customer: state.customer,
      merchantId: state.merchantId,
    }))
  );

  // Set merchant ID for analytics attribution
  useEffect(() => {
    if (merchantId) {
      setMerchantId(merchantId);
    }
  }, [merchantId]);

  // Auto-track screen views on route change
  useEffect(() => {
    if (pathname) {
      // Convert pathname to readable screen name
      const screenName =
        pathname
          .replace(/^\/(tabs\/)?/, '') // Remove leading slash and tabs
          .replace(/\[.*?\]/g, '') // Remove dynamic segments
          .replace(/\//g, ' > ') // Replace slashes with arrows
          .trim() || 'Home';

      trackScreenView(screenName);
    }
  }, [pathname]);

  // Identify user when they log in
  // BUG-4-003 FIX: Use specific properties in deps to avoid stale context
  useEffect(() => {
    if (user?.id && customer) {
      identifyUser(user.id, {
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
      });
    } else if (!user?.id && !customer) {
      // Reset identity on logout
      resetUserIdentity();
    }
  }, [
    user?.id,
    customer?.id,
    customer?.email,
    customer?.first_name,
    customer?.last_name,
    customer?.phone,
    customer,
  ]);

  // Product viewed
  const onProductViewed = (product: Product) => {
    trackProductViewed(product);
  };

  // Add to cart
  const onAddToCart = (item: CartItem, cartTotal?: number) => {
    trackAddToCart(
      {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        currency: item.currency,
        category: item.category,
      },
      cartTotal
    );
  };

  // Checkout started
  const onCheckoutStarted = (checkout: {
    itemCount: number;
    subtotal: number;
    currency?: string;
    items?: CartItem[];
  }) => {
    trackCheckoutStarted(checkout);
  };

  // Purchase completed - includes user data for server-side tracking
  const onPurchase = (order: Order) => {
    // Include user data from auth store if not provided
    const enrichedOrder = {
      ...order,
      email: order.email || customer?.email,
      phone: order.phone || customer?.phone,
      userId: order.userId || user?.id,
    };
    trackPurchase(enrichedOrder);
  };

  // Search
  const onSearch = (query: string, resultCount: number) => {
    trackSearch(query, resultCount);
  };

  // Custom event
  const trackEvent = (
    eventName: string,
    params?: Record<string, string | number | boolean>
  ) => {
    trackCustomEvent(eventName, params);
  };

  // Logout - reset identity
  const onLogout = async () => {
    await resetUserIdentity();
  };

  // Request ATT permission
  const requestTracking = async () => {
    return await requestTrackingPermission();
  };

  // Check if tracking is enabled
  const isTracking = () => {
    return isTrackingEnabled();
  };

  // Payment info added
  const onPaymentInfoAdded = (paymentMethod: string) => {
    trackPaymentInfoAdded(paymentMethod);
  };

  // Signup tracking with user data
  const onSignup = (method: string) => {
    trackSignup(method, {
      email: customer?.email,
      phone: customer?.phone,
      userId: user?.id,
    });
  };

  return {
    // E-commerce events
    onProductViewed,
    onAddToCart,
    onCheckoutStarted,
    onPurchase,
    onPaymentInfoAdded,
    onSearch,
    // Auth events
    onSignup,
    onLogout,
    // Custom events
    trackEvent,
    // Tracking control
    requestTracking,
    isTracking,
  };
}
