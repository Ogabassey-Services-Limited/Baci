import {
  type SnapchatEventName,
  sendSnapchatEvent,
  snapchatCAPI,
} from '@/lib/snapchat-capi';
import type { ConversionEvent } from './ad-platform-conversion-event';
import type { AnalyticsPlatformConfig } from './analytics-platform-config-types';

export async function sendSnapchatAdPlatformEvent(
  config: Readonly<AnalyticsPlatformConfig>,
  event: ConversionEvent,
  eventName: SnapchatEventName,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!config.snapchat_pixel_id || !config.snapchat_capi_token) {
    return { success: false, error: 'not_configured' };
  }
  const userData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    ipAddress: event.user_data.ip,
    userAgent: event.user_data.ua,
    clickId: event.user_data.sccid,
  };
  const pixel = config.snapchat_pixel_id;
  const token = config.snapchat_capi_token;
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const contents = event.custom_data.contents || [];
  const first = contents[0];
  const productIds = contents.map((content) => content.id);
  const parsedTime = event.occurred_at
    ? Date.parse(event.occurred_at)
    : Number.NaN;
  const eventTime =
    Number.isFinite(parsedTime) && parsedTime > 0
      ? Math.floor(parsedTime / 1_000)
      : undefined;
  if (eventName === 'PURCHASE') {
    return value && event.custom_data.order_id && contents.length > 0
      ? await snapchatCAPI.purchase(
          pixel,
          token,
          userData,
          event.custom_data.order_id,
          value,
          currency,
          productIds,
          event.event_id,
          signal,
          eventTime
        )
      : { success: false, error: 'missing_purchase_data' };
  }
  if (eventName === 'START_CHECKOUT') {
    return contents.length > 0
      ? await snapchatCAPI.startCheckout(
          pixel,
          token,
          userData,
          value,
          currency,
          productIds,
          event.event_id,
          signal,
          eventTime
        )
      : { success: false, error: 'missing_checkout_data' };
  }
  if (eventName === 'ADD_CART') {
    return first
      ? await snapchatCAPI.addToCart(
          pixel,
          token,
          userData,
          first.id,
          value,
          currency,
          event.event_id,
          signal,
          eventTime
        )
      : { success: false, error: 'missing_cart_data' };
  }
  if (eventName === 'SEARCH' && !event.custom_data.search_string) {
    return { success: false, error: 'missing_search_data' };
  }
  if (
    ![
      'SEARCH',
      'VIEW_CONTENT',
      'ADD_BILLING',
      'ADD_TO_WISHLIST',
      'SIGN_UP',
    ].includes(eventName)
  ) {
    return { success: false, error: `unmapped_event: ${eventName}` };
  }
  return await sendSnapchatEvent(
    pixel,
    token,
    eventName,
    userData,
    eventName === 'SEARCH'
      ? {
          currency,
          itemIds: productIds,
          searchString: event.custom_data.search_string,
        }
      : {
          currency,
          itemIds: productIds,
          numberOfItems: productIds.length || undefined,
          price: value,
        },
    event.event_id,
    signal,
    eventTime
  );
}
