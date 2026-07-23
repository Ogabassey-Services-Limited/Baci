const CONVERSION_NAME_TO_DB: Readonly<Record<string, string>> = {
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

export function normalizeEventType(eventName: string): string | undefined {
  return CONVERSION_NAME_TO_DB[eventName];
}
