import { createLogger } from '@/lib/logger';

interface QuizMobileAdsInitializationResult {
  canRequestAds: boolean;
}

const log = createLogger('QuizMobileAds');
let initializationPromise: Promise<QuizMobileAdsInitializationResult> | null =
  null;
let consentPromise: Promise<void> | null = null;

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

  await prepareQuizMobileAdsConsent(AdsConsent);
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

type QuizMobileAdsConsent = {
  gatherConsent: () => Promise<unknown>;
};

export function prepareQuizMobileAdsConsent(
  consent?: QuizMobileAdsConsent
): Promise<void> {
  if (!consentPromise) {
    consentPromise = Promise.resolve()
      .then(async () => {
        const adsConsent =
          consent ??
          (
            require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads')
          ).AdsConsent;
        try {
          await adsConsent.gatherConsent();
        } catch {
          log.warn(
            'Consent refresh unavailable; checking the previous consent state.'
          );
        }
      })
      .catch((error) => {
        consentPromise = null;
        throw error;
      });
  }
  return consentPromise;
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
