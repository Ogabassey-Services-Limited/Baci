import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const iconImage = require('../assets/images/icon.png');

type AnimatedSplashProps = {
  isReady: boolean;
  onAnimationEnd: () => void;
};

export function AnimatedSplash({
  isReady,
  onAnimationEnd,
}: AnimatedSplashProps) {
  // Logo starts fully visible to match native splash (no black gap)
  const logoScale = useRef(new Animated.Value(1)).current;
  const shimmerOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Start shimmer pulse after a brief delay (logo is already visible)
  useEffect(() => {
    Animated.timing(shimmerOpacity, {
      toValue: 0.6,
      duration: 400,
      delay: 300,
      useNativeDriver: true,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.6,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [shimmerOpacity]);

  // Exit animation when app is ready
  useEffect(() => {
    if (isReady) {
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1.1,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 400,
          delay: 100,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationEnd();
      });
    }
  }, [isReady, logoScale, containerOpacity, onAnimationEnd]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.View
        style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}
      >
        <Image source={iconImage} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <Animated.View style={[styles.shimmerBar, { opacity: shimmerOpacity }]}>
        <View style={styles.shimmerFill} />
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: shimmerOpacity }]}>
        Buy Now, Pay Later
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  shimmerBar: {
    marginTop: 32,
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  shimmerFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },
  tagline: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
  },
});
