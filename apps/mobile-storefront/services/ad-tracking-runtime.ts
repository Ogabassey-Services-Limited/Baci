import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import {
  getTrackingPermissionStatus,
  requestTrackingPermissionStatus,
} from '@/lib/tracking-transparency';
import { toTikTokEventData } from './tiktok-event-data';
import {
  AD_API_URL,
  adTrackingLog as log,
  FB_APP_ID,
  FB_CLIENT_TOKEN,
  getAdTrackingModules,
  getCachedMerchantId,
  getCachedUserData,
  getIsInitialized,
  getIsTikTokInitialized,
  getIsTrackingAllowed,
  IS_TIKTOK_BUSINESS_CONFIGURED,
  loadNativeModules,
  setIsInitialized,
  setIsTikTokInitialized,
  setIsTrackingAllowed,
} from './ad-tracking-state';
import type { ConversionData } from './ad-tracking.types';

const SERVER_CONVERSION_TIMEOUT_MS = 5000;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value && typeof (value as { then?: unknown }).then === 'function'
  );
}

// True means the call started without a sync throw; async failures log later.
function runNativeAdModuleCall(label: string, call: () => unknown): boolean {
  try {
    const result = call();
    if (isPromiseLike(result)) {
      void Promise.resolve(result).catch((error: unknown) => {
        log.warn(`${label} failed:`, error);
      });
    }
    return true;
  } catch (error) {
    log.warn(`${label} failed:`, error);
    return false;
  }
}

export async function generateEventId(): Promise<string> {
  const timestamp = Date.now().toString(36);
  const randomBytes = await Crypto.getRandomBytesAsync(8);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${timestamp}_${randomHex}`;
}

export function generateEventIdSync(): string {
  const timestamp = Date.now().toString(36);
  const cryptoUuid =
    typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : null;
  const random =
    typeof cryptoUuid === 'string' && cryptoUuid.length > 0
      ? cryptoUuid.replace(/-/g, '').substring(0, 10)
      : Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `${timestamp}_${random}`;
}

export async function initAdTracking(): Promise<void> {
  if (getIsInitialized()) return;

  let modules = getAdTrackingModules();
  if (
    Platform.OS !== 'web' &&
    (!modules.FBSettings || !modules.TikTokBusiness)
  ) {
    await loadNativeModules();
    modules = getAdTrackingModules();
  }

  try {
    if (Platform.OS === 'ios') {
      const { status } = await getTrackingPermissionStatus();
      setIsTrackingAllowed(status === 'granted');
      runNativeAdModuleCall('Facebook advertiser tracking update', () =>
        modules.FBSettings?.setAdvertiserTrackingEnabled?.(
          getIsTrackingAllowed()
        )
      );
    } else {
      setIsTrackingAllowed(true);
    }

    // Only report backup init after the native SDK call starts cleanly.
    if (
      FB_APP_ID &&
      FB_CLIENT_TOKEN &&
      typeof modules.FBSettings?.initializeSDK === 'function' &&
      runNativeAdModuleCall('Facebook SDK initialization', () =>
        modules.FBSettings?.initializeSDK?.()
      )
    ) {
      log.info('Facebook SDK initialized (backup)');
    }

    if (IS_TIKTOK_BUSINESS_CONFIGURED && modules.TikTokBusiness) {
      setIsTikTokInitialized(
        Boolean(
          modules.TikTokBusiness.initialize?.() ||
            modules.TikTokBusiness.isInitialized?.()
        )
      );
      if (getIsTikTokInitialized()) {
        log.info('TikTok SDK initialized (backup)');
      }
    }

    setIsInitialized(true);
    log.info(
      'Initialized. Server-side tracking enabled. ATT:',
      getIsTrackingAllowed()
    );
  } catch (error) {
    log.error('Initialization error:', error);
  }
}

export async function requestTrackingPermission(): Promise<string> {
  if (Platform.OS !== 'ios') return 'granted';

  try {
    const { status } = await requestTrackingPermissionStatus();
    setIsTrackingAllowed(status === 'granted');
    runNativeAdModuleCall('Facebook advertiser tracking update', () =>
      getAdTrackingModules().FBSettings?.setAdvertiserTrackingEnabled?.(
        getIsTrackingAllowed()
      )
    );
    return status;
  } catch (error) {
    log.error('ATT request error:', error);
    return 'denied';
  }
}

export function isTrackingEnabled(): boolean {
  return getIsTrackingAllowed();
}

export async function sendServerConversion(
  eventName: string,
  eventId: string,
  data: ConversionData
): Promise<void> {
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

export function sendClientBackup(
  eventId: string,
  fbEvent: string,
  ttEvent: string | null,
  value: number,
  currency: string,
  params: Record<string, unknown>,
  tikTokParams: Record<string, unknown> = params
): void {
  const modules = getAdTrackingModules();
  runNativeAdModuleCall('Facebook event log', () =>
    modules.AppEventsLogger?.logEvent?.(fbEvent, value, {
      ...params,
      _eventId: eventId,
    })
  );

  if (Platform.OS === 'ios') {
    runNativeAdModuleCall('Facebook AEM event log', () =>
      modules.AEMReporterIOS?.logAEMEvent?.(fbEvent, value, currency, params)
    );
  }

  trackTikTokEvent(ttEvent, eventId, tikTokParams);
}

export function trackFacebookEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  runNativeAdModuleCall('Facebook event log', () =>
    getAdTrackingModules().AppEventsLogger?.logEvent?.(eventName, params)
  );
}

export function trackFacebookPurchase(
  value: number,
  currency: string,
  params: Record<string, unknown>
): void {
  runNativeAdModuleCall('Facebook purchase log', () =>
    getAdTrackingModules().AppEventsLogger?.logPurchase?.(
      value,
      currency,
      params
    )
  );
}

export function trackAemEvent(
  eventName: string,
  value: number,
  currency: string,
  params: Record<string, unknown>
): void {
  if (Platform.OS === 'ios') {
    runNativeAdModuleCall('Facebook AEM event log', () =>
      getAdTrackingModules().AEMReporterIOS?.logAEMEvent?.(
        eventName,
        value,
        currency,
        params
      )
    );
  }
}

export function trackTikTokEvent(
  eventName: string | null,
  eventId: string,
  params?: Record<string, unknown>
): void {
  if (getIsTikTokInitialized() && eventName) {
    runNativeAdModuleCall('TikTok event log', () =>
      getAdTrackingModules().TikTokBusiness?.trackEvent?.(
        eventName,
        eventId,
        toTikTokEventData(params)
      )
    );
  }
}
