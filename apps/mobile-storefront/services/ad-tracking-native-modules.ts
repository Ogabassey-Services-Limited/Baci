import { Platform } from 'react-native';
import type { TikTokEventData } from './tiktok-event-data';

export interface FBSettingsLike {
  initializeSDK: () => void;
  setAdvertiserTrackingEnabled: (enabled: boolean) => void;
}

export interface AppEventsLoggerLike {
  logEvent: {
    (name: string, params?: Record<string, unknown>): void;
    (name: string, valueToSum: number, params?: Record<string, unknown>): void;
  };
  logPurchase: (
    amount: number,
    currency: string,
    params?: Record<string, unknown>
  ) => void;
  setUserData: (data: Record<string, string | undefined>) => void;
  clearUserID: () => void;
}

export interface AEMReporterIOSLike {
  logAEMEvent: (
    name: string,
    value: number,
    currency: string,
    params: Record<string, unknown>
  ) => void;
}

export interface TikTokBusinessLike {
  initialize?: () => boolean | Promise<boolean>;
  isInitialized?: () => boolean;
  identify?: (
    externalID: string,
    externalUserName?: string,
    phoneNumber?: string,
    email?: string
  ) => void;
  logout?: () => void;
  trackEvent: (
    name: string,
    eventId?: string,
    eventData?: TikTokEventData[]
  ) => void;
}

export interface AdTrackingNativeModules {
  FBSettings: FBSettingsLike | null;
  AppEventsLogger: AppEventsLoggerLike | null;
  AEMReporterIOS: AEMReporterIOSLike | null;
  TikTokBusiness: TikTokBusinessLike | null;
}

export async function loadAdTrackingNativeModules(): Promise<AdTrackingNativeModules> {
  const modules: AdTrackingNativeModules = {
    FBSettings: null,
    AppEventsLogger: null,
    AEMReporterIOS: null,
    TikTokBusiness: null,
  };
  if (Platform.OS === 'web') return modules;

  try {
    const [fb, tt] = await Promise.all([
      import('react-native-fbsdk-next'),
      import('@baci/tiktok-business'),
    ]);

    modules.FBSettings = fb.Settings as unknown as FBSettingsLike;
    modules.AppEventsLogger =
      fb.AppEventsLogger as unknown as AppEventsLoggerLike;
    modules.AEMReporterIOS = fb.AEMReporterIOS as unknown as AEMReporterIOSLike;
    modules.TikTokBusiness = (tt.default ||
      tt) as unknown as TikTokBusinessLike;
  } catch (error) {
    console.debug(
      '[AdTracking] Native modules ignored or failed to load:',
      error
    );
  }

  return modules;
}
