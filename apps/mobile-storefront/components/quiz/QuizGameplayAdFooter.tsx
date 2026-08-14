import { Text, View } from 'react-native';
import type { PaidEvent } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getQuizMobileAdsConfig } from '@/config/quiz-mobile-ads';
import { useQuizMobileAds } from '@/hooks/use-quiz-mobile-ads';
import { useTheme } from '@/hooks/useTheme';
import { trackQuizAdEvent } from '@/services/quiz-ad-analytics';
import { createQuizGameplayAdFooterStyles } from './QuizGameplayAdFooter.styles';

interface QuizGameplayAdFooterProps {
  active: boolean;
}

function getAdErrorCode(error: Error): string {
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'unknown';
}

export function QuizGameplayAdFooter({ active }: QuizGameplayAdFooterProps) {
  const { colors } = useTheme();
  const config = getQuizMobileAdsConfig();
  const adState = useQuizMobileAds({ config, requested: active });
  const styles = createQuizGameplayAdFooterStyles(colors);

  if (
    !active ||
    !adState.enabled ||
    !adState.initialized ||
    !adState.canRequestAds ||
    !adState.bannerUnitId
  ) {
    return null;
  }

  return <QuizGameplayAdPlacement adState={adState} styles={styles} />;
}

type QuizGameplayAdState = ReturnType<typeof useQuizMobileAds>;

function QuizGameplayAdPlacement({
  adState,
  styles,
}: {
  adState: QuizGameplayAdState;
  styles: ReturnType<typeof createQuizGameplayAdFooterStyles>;
}) {
  const insets = useSafeAreaInsets();

  const { BannerAd, BannerAdSize } =
    require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');

  const handlePaid = (event: PaidEvent) => {
    trackQuizAdEvent('quiz_ad_paid', {
      currency: event.currency,
      precision: String(event.precision),
      valueMicros: event.value,
    });
  };

  return (
    <View
      accessibilityLabel="Sponsored advertisement"
      style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}
      testID="quiz-gameplay-ad-footer"
    >
      <Text style={styles.label}>Sponsored</Text>
      <View style={styles.adFrame} testID="quiz-banner-slot">
        <BannerAd
          onAdFailedToLoad={(error) => {
            trackQuizAdEvent('quiz_ad_failed', {
              errorCode: getAdErrorCode(error),
            });
          }}
          onAdImpression={() => trackQuizAdEvent('quiz_ad_impression')}
          onPaid={handlePaid}
          size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
          unitId={adState.bannerUnitId}
        />
      </View>
    </View>
  );
}
