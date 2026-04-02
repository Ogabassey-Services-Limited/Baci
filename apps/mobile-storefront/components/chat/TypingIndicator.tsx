import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

const DOT_COUNT = 3;
const DOT_SIZE = 8;
const DOT_DELAY_MS = 160;
const DOT_ANIMATION_MS = 520;

export function TypingIndicator() {
  const animatedValues = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.35))
  ).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        DOT_DELAY_MS,
        animatedValues.map((value) =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: DOT_ANIMATION_MS,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0.35,
              duration: DOT_ANIMATION_MS,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        )
      )
    );

    loop.start();

    return () => {
      loop.stop();
      animatedValues.forEach((value) => value.stopAnimation());
    };
  }, [animatedValues]);

  return (
    <View
      style={styles.container}
      accessibilityLabel="Ogabassey AI is typing"
      accessibilityRole="progressbar"
    >
      {animatedValues.map((value, index) => (
        <Animated.View
          key={index}
          testID="typing-indicator-dot"
          style={[
            styles.dot,
            {
              opacity: value,
              transform: [
                {
                  scale: value.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0.82, 1.15],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 16,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: BRAND.primary,
    elevation: 3,
    shadowColor: BRAND.primary,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    marginVertical: SPACING.xs / 2,
  },
  bubble: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS['2xl'],
    borderBottomLeftRadius: RADIUS.sm,
    borderWidth: 1,
  },
});
