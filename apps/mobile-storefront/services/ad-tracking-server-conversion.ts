import { Platform } from 'react-native';
import type { ConversionData } from './ad-tracking.types';
import {
  AD_API_URL,
  getCachedMerchantId,
  getCachedUserData,
  getIsTrackingAllowed,
  adTrackingLog as log,
} from './ad-tracking-state';

const SERVER_CONVERSION_TIMEOUT_MS = 5000;

export async function sendServerConversion(
  eventName: string,
  eventId: string,
  data: ConversionData
): Promise<void> {
  if (!getIsTrackingAllowed()) return;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SERVER_CONVERSION_TIMEOUT_MS
  );

  try {
    const userData = getCachedUserData();
    const response = await fetch(`${AD_API_URL}/analytics/conversion`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_time: Math.floor(Date.now() / 1000),
        event_source: 'mobile_app',
        platform: Platform.OS,
        ...(getCachedMerchantId() && { merchant_id: getCachedMerchantId() }),
        user_data: {
          em: data.email || userData.email,
          ph: data.phone || userData.phone,
          external_id: data.userId || userData.userId,
          fn: userData.firstName,
          ln: userData.lastName,
        },
        custom_data: {
          order_id: data.orderId,
          value: data.value,
          currency: data.currency || 'NGN',
          content_name: data.contentName,
          content_type: data.contentType,
          contents: data.items,
          price: data.price,
          search_string: data.searchString,
          url: data.url,
        },
        targets: ['facebook', 'tiktok', 'snapchat', 'google'],
      }),
    });

    if (__DEV__) {
      const result = await response.json();
      log.debug(`[Server] ${eventName} sent:`, result);
    } else {
      await response.text();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.warn(
        `Server conversion timed out after ${SERVER_CONVERSION_TIMEOUT_MS}ms`
      );
      return;
    }
    log.warn('Server conversion error:', error);
  } finally {
    clearTimeout(timeout);
  }
}
