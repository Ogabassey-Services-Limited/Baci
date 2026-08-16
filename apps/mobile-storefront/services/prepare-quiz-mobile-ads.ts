import { isQuizMobileAdsAvailable } from '@/components/quiz/is-quiz-mobile-ads-available';
import { getQuizMobileAdsConfig } from '@/config/quiz-mobile-ads';
import { getFeatureFlagValue } from '@/services/analytics-core';
import { initializeQuizMobileAds } from './initialize-quiz-mobile-ads';

/**
 * Prepares consent and the native ads SDK before the timed attempt starts.
 * Ads are optional: configuration, native-module, consent, and SDK failures
 * must never prevent a shopper from starting the quiz. The boolean result is
 * used by the start flow to prevent a second consent/SDK attempt once timed
 * gameplay has begun.
 */
export async function prepareQuizMobileAds(): Promise<boolean> {
  try {
    const config = getQuizMobileAdsConfig();
    if (!config.enabled || !isQuizMobileAdsAvailable()) return true;
    if ((await getFeatureFlagValue('quiz-mobile-ads')) === false) return true;
    await initializeQuizMobileAds();
    return true;
  } catch {
    // Gameplay remains available when ads cannot be prepared on this client.
    return false;
  }
}
