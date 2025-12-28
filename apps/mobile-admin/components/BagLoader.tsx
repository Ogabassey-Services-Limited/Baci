/**
 * BagLoader Component
 * Animated loading indicator with floating bag icon and orbiting particles
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface BagLoaderProps {
  size?: number;
}

const AnimatedView = Animated.createAnimatedComponent(View);

// Particle configuration
const particles = [
  { color: '#f0bf58', size: 6, delay: 0 },
  { color: '#f0bf58', size: 4, delay: 400 },
  { color: '#23255d', size: 5, delay: 825 },
  { color: '#f0bf58', size: 3, delay: 1250 },
];

const DURATION = 2500;

function OrbitingParticle({
  color,
  particleSize,
  delay,
  rx,
  ry,
}: {
  color: string;
  particleSize: number;
  delay: number;
  rx: number;
  ry: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: DURATION, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const angle = progress.value * 2 * Math.PI;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    const scale = interpolate(Math.sin(angle), [-1, 1], [0.6, 1.2]);
    const opacity = interpolate(Math.sin(angle), [-1, 1], [0.5, 1]);

    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
    };
  });

  return (
    <AnimatedView
      style={[
        styles.particle,
        {
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
          marginLeft: -particleSize / 2,
          marginTop: -particleSize / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

export function BagLoader({ size = 48 }: BagLoaderProps) {
  const floatValue = useSharedValue(0);

  useEffect(() => {
    floatValue.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [floatValue]);

  const floatStyle = useAnimatedStyle(() => {
    const translateY = interpolate(floatValue.value, [0, 1], [-4, 4]);
    return {
      transform: [{ translateY }],
    };
  });

  const rx = size * 0.65;
  const ry = size * 0.2;

  return (
    <View style={[styles.container, { width: size * 2, height: size * 1.5 }]}>
      {/* Central Bag Icon */}
      <AnimatedView style={[styles.bagContainer, floatStyle]}>
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <Ionicons name="bag-handle" size={size * 0.8} color="#23255d" />
        </View>
      </AnimatedView>

      {/* Orbiting Particles */}
      {particles.map((particle, index) => (
        <OrbitingParticle
          key={index}
          color={particle.color}
          particleSize={particle.size}
          delay={particle.delay}
          rx={rx}
          ry={ry}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagContainer: {
    zIndex: 10,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },
});
