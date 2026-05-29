import { trackEvent } from './analytics-core';

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

export function trackCheckoutStep(
  step: 'shipping_info' | 'payment_method' | 'review',
  properties?: Record<string, unknown>
): void {
  trackEvent('Checkout Step Completed', {
    step,
    ...properties,
  });
}

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

export function trackPaymentFailed(reason: string, orderId?: string): void {
  trackEvent('Payment Failed', {
    reason,
    order_id: orderId,
  });
}

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

export function trackWishlistAction(
  action: 'added' | 'removed',
  product: { id: string; name: string }
): void {
  trackEvent(`Wishlist Item ${action === 'added' ? 'Added' : 'Removed'}`, {
    product_id: product.id,
    product_name: product.name,
  });
}

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

export function trackAppReviewPrompt(
  action: 'shown' | 'accepted' | 'declined' | 'later'
): void {
  trackEvent('App Review Prompt', { action });
}

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
