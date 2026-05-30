import { useEffect } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function useCheckoutCtaAnimation(isProcessing: boolean) {
  const ctaArrowTranslateX = useSharedValue(0);

  useEffect(() => {
    if (isProcessing) {
      cancelAnimation(ctaArrowTranslateX);
      ctaArrowTranslateX.set(0);
      return;
    }

    ctaArrowTranslateX.set(
      withRepeat(
        withSequence(
          withTiming(6, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(ctaArrowTranslateX);
      ctaArrowTranslateX.set(0);
    };
  }, [ctaArrowTranslateX, isProcessing]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: ctaArrowTranslateX.get() }],
  }));
}
