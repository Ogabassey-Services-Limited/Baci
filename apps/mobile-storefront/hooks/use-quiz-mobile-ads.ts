import { useEffect, useState } from 'react';

import { isQuizMobileAdsAvailable } from '@/components/quiz/is-quiz-mobile-ads-available';
import type { QuizMobileAdsConfig } from '@/config/quiz-mobile-ads';
import { getFeatureFlagValue } from '@/services/analytics-core';
import { initializeQuizMobileAds } from '@/services/initialize-quiz-mobile-ads';

interface UseQuizMobileAdsOptions {
  config: QuizMobileAdsConfig;
  ageVerified?: boolean;
  requested: boolean;
}

interface QuizMobileAdsState {
  bannerUnitId: string | null;
  canRequestAds: boolean;
  enabled: boolean;
  initialized: boolean;
}

const DISABLED_STATE: QuizMobileAdsState = {
  bannerUnitId: null,
  canRequestAds: false,
  enabled: false,
  initialized: false,
};

export function useQuizMobileAds({
  ageVerified = false,
  config,
  requested,
}: UseQuizMobileAdsOptions): QuizMobileAdsState {
  const bannerUnitId = config.enabled ? config.bannerUnitId : null;
  const [state, setState] = useState<QuizMobileAdsState>(DISABLED_STATE);

  useEffect(() => {
    let active = true;

    if (
      !requested ||
      !config.enabled ||
      !bannerUnitId ||
      !isQuizMobileAdsAvailable()
    ) {
      setState(DISABLED_STATE);
      return () => {
        active = false;
      };
    }

    setState({
      bannerUnitId,
      canRequestAds: false,
      enabled: true,
      initialized: false,
    });

    void (async () => {
      const runtimeFlag = await getFeatureFlagValue('quiz-mobile-ads');
      if (!active) return;

      if (runtimeFlag === false) {
        setState({ ...DISABLED_STATE, initialized: true });
        return;
      }

      const result = await initializeQuizMobileAds(undefined, {
        ageVerified,
      }).catch(() => null);
      if (!active) return;

      if (!result) {
        setState({ ...DISABLED_STATE, initialized: true });
        return;
      }

      setState({
        bannerUnitId,
        canRequestAds: result.canRequestAds,
        enabled: true,
        initialized: true,
      });
    })();

    return () => {
      active = false;
    };
  }, [ageVerified, bannerUnitId, config.enabled, requested]);

  return state;
}
