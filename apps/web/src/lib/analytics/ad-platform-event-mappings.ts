import type { FacebookEventName } from '@/lib/facebook-capi';
import type { SnapchatEventName } from '@/lib/snapchat-capi';
import type { TikTokEventName } from '@/lib/tiktok-events-api';

const FACEBOOK: Readonly<Record<string, FacebookEventName>> = {
  purchase: 'Purchase',
  begin_checkout: 'InitiateCheckout',
  add_to_cart: 'AddToCart',
  product_view: 'ViewContent',
  add_payment_info: 'AddPaymentInfo',
  add_to_wishlist: 'AddToWishlist',
  search: 'Search',
  customer_registered: 'CompleteRegistration',
};
const TIKTOK: Readonly<Record<string, TikTokEventName>> = {
  ...FACEBOOK,
  place_order: 'PlaceAnOrder',
};
const SNAPCHAT: Readonly<Record<string, SnapchatEventName>> = {
  purchase: 'PURCHASE',
  begin_checkout: 'START_CHECKOUT',
  add_to_cart: 'ADD_CART',
  product_view: 'VIEW_CONTENT',
  add_payment_info: 'ADD_BILLING',
  add_to_wishlist: 'ADD_TO_WISHLIST',
  search: 'SEARCH',
  customer_registered: 'SIGN_UP',
};

export function getAdPlatformEventMappings(eventType: string): {
  facebook?: FacebookEventName;
  snapchat?: SnapchatEventName;
  tiktok?: TikTokEventName;
} {
  return {
    facebook: FACEBOOK[eventType],
    snapchat: SNAPCHAT[eventType],
    tiktok: TIKTOK[eventType],
  };
}
