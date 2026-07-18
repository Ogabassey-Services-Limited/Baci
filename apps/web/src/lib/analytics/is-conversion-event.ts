const CONVERSION_EVENT_TYPES = new Set([
  'purchase',
  'begin_checkout',
  'add_to_cart',
  'product_view',
  'add_payment_info',
  'add_to_wishlist',
  'search',
  'customer_registered',
  'place_order',
]);

export function isConversionEvent(eventType: string): boolean {
  return CONVERSION_EVENT_TYPES.has(eventType);
}
