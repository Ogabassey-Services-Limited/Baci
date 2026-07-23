import { type TikTokEventName, tiktokEventsAPI } from '@/lib/tiktok-events-api';
import type { ConversionEvent } from './ad-platform-conversion-event';
import { toAdPlatformProducts } from './ad-platform-products';
import type { AnalyticsPlatformConfig } from './analytics-platform-config-types';

export async function sendTikTokAdPlatformEvent(
  config: Readonly<AnalyticsPlatformConfig>,
  event: ConversionEvent,
  eventName: TikTokEventName,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  if (!config.tiktok_pixel_id || !config.tiktok_access_token) {
    return { success: false, error: 'not_configured' };
  }
  const userData = {
    email: event.user_data.email,
    phone: event.user_data.phone,
    externalId: event.user_data.external_id,
    ipAddress: event.user_data.ip,
    ttclid: event.user_data.ttclid,
    ttp: event.user_data.ttp,
    userAgent: event.user_data.ua,
  };
  const contents = event.custom_data.contents || [];
  const first = contents[0];
  const currency = event.custom_data.currency || 'NGN';
  const value = event.custom_data.value || 0;
  const options = {
    eventId: event.event_id,
    eventTime: event.occurred_at,
    url: event.custom_data.url,
  };
  const properties = {
    value: event.custom_data.value,
    currency,
    contentId: first?.id,
    contentIds:
      contents.length > 0 ? contents.map((content) => content.id) : undefined,
    contentName: event.custom_data.content_name || first?.name || first?.id,
    contentType: event.custom_data.content_type || 'product',
    price: event.custom_data.price ?? first?.price,
    orderId: event.custom_data.order_id,
    searchString: event.custom_data.search_string,
    url: event.custom_data.url,
    contents:
      contents.length > 0
        ? contents.map((content) => ({
            content_id: content.id,
            content_name: content.name || content.id,
            price: content.price,
            quantity: content.quantity,
          }))
        : undefined,
  };
  const pixel = config.tiktok_pixel_id;
  const token = config.tiktok_access_token;
  if (eventName === 'Purchase') {
    return value && event.custom_data.order_id && contents.length > 0
      ? await tiktokEventsAPI.purchase(
          pixel,
          token,
          userData,
          event.custom_data.order_id,
          value,
          currency,
          toAdPlatformProducts(contents),
          options,
          signal
        )
      : { success: false, error: 'missing_purchase_data' };
  }
  if (eventName === 'InitiateCheckout') {
    return contents.length > 0
      ? await tiktokEventsAPI.initiateCheckout(
          pixel,
          token,
          userData,
          properties,
          options,
          undefined,
          undefined,
          signal
        )
      : { success: false, error: 'missing_checkout_data' };
  }
  if (eventName === 'AddToCart') {
    return contents.length > 0
      ? await tiktokEventsAPI.addToCart(
          pixel,
          token,
          userData,
          properties,
          options,
          signal
        )
      : { success: false, error: 'missing_cart_data' };
  }
  if (eventName === 'ViewContent') {
    return contents.length > 0
      ? await tiktokEventsAPI.viewContent(
          pixel,
          token,
          userData,
          properties,
          options,
          signal
        )
      : { success: false, error: 'missing_content_data' };
  }
  if (eventName === 'Search') {
    return event.custom_data.search_string
      ? await tiktokEventsAPI.search(
          pixel,
          token,
          userData,
          event.custom_data.search_string,
          options,
          signal
        )
      : { success: false, error: 'missing_search_data' };
  }
  const methods = {
    AddPaymentInfo: tiktokEventsAPI.addPaymentInfo,
    AddToWishlist: tiktokEventsAPI.addToWishlist,
    CompleteRegistration: tiktokEventsAPI.completeRegistration,
    PlaceAnOrder: tiktokEventsAPI.placeAnOrder,
  } as const;
  const method = methods[eventName as keyof typeof methods];
  return method
    ? await method(pixel, token, userData, properties, options, signal)
    : { success: false, error: `unmapped_event: ${eventName}` };
}
