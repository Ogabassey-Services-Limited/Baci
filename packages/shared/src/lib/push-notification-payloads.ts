export type PushPayload = Record<string, unknown>;

export type AdminNotificationNavigationTarget =
  | { screen: 'order'; params: { id: string } }
  | { screen: 'orders' }
  | { screen: 'product'; params: { id: string } }
  | { screen: 'products' }
  | { screen: 'notifications' }
  | { screen: 'negotiation'; params: { id: string } }
  | { screen: 'negotiations' }
  | { screen: 'index' };

export type StorefrontNotificationNavigationTarget =
  | { screen: 'order-details'; params: { id: string } }
  | { screen: 'orders' }
  | { screen: 'product'; params: { slug: string } }
  | { screen: 'category'; params: { slug: string } }
  | { screen: 'wallet' }
  | { screen: 'home' };

function readString(
  payload: PushPayload,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return undefined;
}

export function getAdminNotificationNavigationTarget(
  payload: PushPayload | null | undefined
): AdminNotificationNavigationTarget | null {
  if (!payload) {
    return null;
  }

  const type = readString(payload, 'type');
  if (!type) {
    return null;
  }

  switch (type) {
    case 'new_order':
    case 'payment_received': {
      const orderId = readString(payload, 'order_id', 'orderId');
      return orderId
        ? { screen: 'order', params: { id: orderId } }
        : { screen: 'orders' };
    }
    case 'low_stock': {
      const productId = readString(payload, 'product_id', 'productId');
      return productId
        ? { screen: 'product', params: { id: productId } }
        : { screen: 'products' };
    }
    case 'admin_broadcast':
      return { screen: 'notifications' };
    case 'jumia_order':
      return { screen: 'orders' };
    case 'negotiation': {
      const negotiationId = readString(
        payload,
        'negotiation_id',
        'negotiationId'
      );
      return negotiationId
        ? { screen: 'negotiation', params: { id: negotiationId } }
        : { screen: 'negotiations' };
    }
    default:
      return { screen: 'index' };
  }
}

export function getStorefrontNotificationNavigationTarget(
  payload: PushPayload | null | undefined
): StorefrontNotificationNavigationTarget | null {
  if (!payload) {
    return null;
  }

  const type = readString(payload, 'type');
  if (!type) {
    return null;
  }

  switch (type) {
    case 'order_update': {
      const orderId = readString(payload, 'orderId', 'order_id');
      return orderId
        ? { screen: 'order-details', params: { id: orderId } }
        : { screen: 'orders' };
    }
    case 'promotion': {
      const productSlug = readString(payload, 'productSlug', 'product_slug');
      if (productSlug) {
        return { screen: 'product', params: { slug: productSlug } };
      }

      const categorySlug = readString(payload, 'categorySlug', 'category_slug');
      return categorySlug
        ? { screen: 'category', params: { slug: categorySlug } }
        : { screen: 'home' };
    }
    case 'back_in_stock':
    case 'price_drop':
    case 'negotiation_response': {
      const productSlug = readString(payload, 'productSlug', 'product_slug');
      return productSlug
        ? { screen: 'product', params: { slug: productSlug } }
        : { screen: 'home' };
    }
    case 'vtu_cashback_monthly_summary':
      return { screen: 'wallet' };
    default:
      return { screen: 'home' };
  }
}
