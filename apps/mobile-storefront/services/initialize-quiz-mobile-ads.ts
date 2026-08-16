import { createLogger } from '@/lib/logger';

interface QuizMobileAdsInitializationResult {
  canRequestAds: boolean;
}

const log = createLogger('QuizMobileAds');
let initializationPromise: Promise<QuizMobileAdsInitializationResult> | null =
  null;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Quiz ad preparation was cancelled.');
}

async function initialize(
  signal?: AbortSignal
): Promise<QuizMobileAdsInitializationResult> {
  throwIfAborted(signal);
  const {
    default: mobileAds,
    AdsConsent,
    MaxAdContentRating,
  } = require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');

  try {
    await AdsConsent.gatherConsent();
  } catch {
    log.warn(
      'Consent refresh unavailable; checking the previous consent state.'
    );
  }

  throwIfAborted(signal);
  const { canRequestAds } = await AdsConsent.getConsentInfo();
  throwIfAborted(signal);
  if (!canRequestAds) return { canRequestAds: false };

  const ads = mobileAds();
  await ads.setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.T,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
    testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
  });
  throwIfAborted(signal);
  await ads.initialize();

  return { canRequestAds: true };
}

export function initializeQuizMobileAds(
  signal?: AbortSignal
): Promise<QuizMobileAdsInitializationResult> {
  if (signal?.aborted) {
    return Promise.reject(new Error('Quiz ad preparation was cancelled.'));
  }
  if (!initializationPromise) {
    initializationPromise = initialize(signal).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}
