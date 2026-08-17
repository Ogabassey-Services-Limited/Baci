import { createLogger } from '@/lib/logger';

interface QuizMobileAdsInitializationResult {
  canRequestAds: boolean;
}

export interface QuizMobileAdsInitializationOptions {
  /** Only a locally validated adult DOB may opt out of under-age treatment. */
  ageVerified?: boolean;
}

const log = createLogger('QuizMobileAds');
let consentPromise: Promise<void> | null = null;
let nativeInitializationPromise: Promise<void> | null = null;
let configurationPromise: Promise<void> = Promise.resolve();
let configuredUnderAgeOfConsent: boolean | null = null;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Quiz ad preparation was cancelled.');
}

async function initialize(
  signal?: AbortSignal,
  options: QuizMobileAdsInitializationOptions = {}
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
  const underAgeOfConsent = options.ageVerified !== true;
  configurationPromise = configurationPromise
    .catch(() => undefined)
    .then(async () => {
      if (configuredUnderAgeOfConsent === underAgeOfConsent) return;
      await ads.setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        // Unknown or under-age shoppers stay in the protective configuration.
        // The quiz API remains the authority for participation; this only
        // prevents an unverified client from configuring the SDK as an adult.
        tagForUnderAgeOfConsent: underAgeOfConsent,
        testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
      });
      configuredUnderAgeOfConsent = underAgeOfConsent;
    });
  await configurationPromise;
  throwIfAborted(signal);
  if (!nativeInitializationPromise) {
    nativeInitializationPromise = ads
      .initialize()
      .then(() => undefined)
      .catch((error) => {
        nativeInitializationPromise = null;
        throw error;
      });
  }
  await nativeInitializationPromise;

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
  signal?: AbortSignal,
  options?: QuizMobileAdsInitializationOptions
): Promise<QuizMobileAdsInitializationResult> {
  if (signal?.aborted) {
    return Promise.reject(new Error('Quiz ad preparation was cancelled.'));
  }
  return initialize(signal, options);
}
