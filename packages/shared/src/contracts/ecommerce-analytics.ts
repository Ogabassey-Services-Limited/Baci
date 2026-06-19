export const ECOMMERCE_ANALYTICS_EVENTS = {
  productsSearched: 'Products Searched',
  productListViewed: 'Product List Viewed',
  productViewed: 'Product Viewed',
  productAdded: 'Product Added',
  productRemoved: 'Product Removed',
  cartViewed: 'Cart Viewed',
  checkoutStarted: 'Checkout Started',
  checkoutStepViewed: 'Checkout Step Viewed',
  checkoutStepCompleted: 'Checkout Step Completed',
  paymentInfoEntered: 'Payment Info Entered',
  orderCompleted: 'Order Completed',
  paymentFailed: 'Payment Failed',
  productAddedToWishlist: 'Product Added to Wishlist',
  productRemovedFromWishlist: 'Product Removed from Wishlist',
  contentShared: 'Content Shared',
  notificationInteraction: 'Notification Interaction',
  appReviewPrompt: 'App Review Prompt',
  timing: 'Timing',
  error: 'Error',
} as const;

export type EcommerceAnalyticsEventName =
  (typeof ECOMMERCE_ANALYTICS_EVENTS)[keyof typeof ECOMMERCE_ANALYTICS_EVENTS];

export type CheckoutStepName = 'shipping_info' | 'payment_method' | 'review';

export type WishlistAction = 'added' | 'removed';

export type AnalyticsProperties = Record<string, unknown>;

export type AnalyticsProduct = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  currency?: string;
  category?: string;
  brand?: string;
  slug?: string;
  sku?: string;
  variant?: string;
  coupon?: string;
  position?: number;
  url?: string;
  imageUrl?: string;
};

export type AnalyticsOrder = {
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
};

const DEFAULT_CURRENCY = 'NGN';

const CHECKOUT_STEP_INDEX: Record<CheckoutStepName, number> = {
  shipping_info: 1,
  payment_method: 2,
  review: 3,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => compactValue(item))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    return compactAnalyticsProperties(value);
  }

  return value;
}

export function compactAnalyticsProperties(
  properties: AnalyticsProperties
): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties)
      .map(([key, value]) => [key, compactValue(value)] as const)
      .filter(([, value]) => value !== undefined)
  );
}

function currencyFor(value?: string): string {
  return value || DEFAULT_CURRENCY;
}

function productValue(product: Pick<AnalyticsProduct, 'price' | 'quantity'>) {
  return product.price * (product.quantity ?? 1);
}

export function buildProductProperties(
  product: AnalyticsProduct
): AnalyticsProperties {
  return compactAnalyticsProperties({
    product_id: product.id,
    sku: product.sku,
    category: product.category,
    name: product.name,
    // Kept while mobile historical reports still use this legacy alias.
    product_name: product.name,
    brand: product.brand,
    variant: product.variant,
    price: product.price,
    quantity: product.quantity,
    coupon: product.coupon,
    currency: currencyFor(product.currency),
    value: productValue(product),
    position: product.position,
    url: product.url,
    image_url: product.imageUrl,
    slug: product.slug,
  });
}

export function buildProductViewedProperties(
  product: AnalyticsProduct
): AnalyticsProperties {
  return buildProductProperties(product);
}

export function buildProductAddedProperties(
  product: AnalyticsProduct,
  cartValue?: number
): AnalyticsProperties {
  return compactAnalyticsProperties({
    ...buildProductProperties(product),
    cart_value: cartValue,
  });
}

export function buildProductRemovedProperties(
  product: AnalyticsProduct
): AnalyticsProperties {
  return buildProductProperties(product);
}

export function buildCheckoutStartedProperties(checkout: {
  cartId?: string;
  itemCount: number;
  subtotal: number;
  currency?: string;
}): AnalyticsProperties {
  return compactAnalyticsProperties({
    cart_id: checkout.cartId,
    item_count: checkout.itemCount,
    subtotal: checkout.subtotal,
    currency: currencyFor(checkout.currency),
    value: checkout.subtotal,
  });
}

export function buildCheckoutStepCompletedProperties(
  step: CheckoutStepName,
  properties?: AnalyticsProperties
): AnalyticsProperties {
  return compactAnalyticsProperties({
    checkout_step: step,
    step,
    step_name: step,
    step_index: CHECKOUT_STEP_INDEX[step],
    ...properties,
  });
}

export function buildOrderCompletedProperties(
  order: AnalyticsOrder
): AnalyticsProperties {
  return compactAnalyticsProperties({
    order_id: order.orderId,
    order_number: order.orderNumber,
    total: order.total,
    value: order.total,
    subtotal: order.subtotal,
    shipping: order.shipping,
    tax: order.tax,
    currency: currencyFor(order.currency),
    item_count: order.itemCount,
    payment_method: order.paymentMethod,
    coupon_code: order.couponCode,
  });
}

export function buildPaymentFailedProperties(
  reason: string,
  orderId?: string
): AnalyticsProperties {
  return compactAnalyticsProperties({
    reason,
    order_id: orderId,
  });
}

export function buildProductsSearchedProperties(
  query: string,
  resultCount: number,
  filters?: AnalyticsProperties
): AnalyticsProperties {
  return compactAnalyticsProperties({
    query,
    result_count: resultCount,
    filters,
  });
}

export function buildProductListViewedProperties(category: {
  name: string;
  slug: string;
  productCount?: number;
}): AnalyticsProperties {
  return compactAnalyticsProperties({
    list_id: category.slug,
    category: category.name,
    category_name: category.name,
    category_slug: category.slug,
    product_count: category.productCount,
  });
}

export function buildWishlistProductProperties(product: {
  id: string;
  name: string;
}): AnalyticsProperties {
  return compactAnalyticsProperties({
    product_id: product.id,
    name: product.name,
    product_name: product.name,
  });
}

export function eventForWishlistAction(
  action: WishlistAction
): EcommerceAnalyticsEventName {
  return action === 'added'
    ? ECOMMERCE_ANALYTICS_EVENTS.productAddedToWishlist
    : ECOMMERCE_ANALYTICS_EVENTS.productRemovedFromWishlist;
}
