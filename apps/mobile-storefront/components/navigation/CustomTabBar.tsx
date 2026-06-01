import { useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { BRAND } from '@/constants/Colors';
import { getTabBarShadowStyle } from '@/components/navigation/TabBar.shadows';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ACTIVE_PILL_HEIGHT = 38;

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();

  // Filter visible routes (ignore options.href === null)
  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return options.href !== null;
  });

  const tabWidths = useSharedValue<number[]>(new Array(visibleRoutes.length).fill(72));
  const tabOffsets = useSharedValue<number[]>(new Array(visibleRoutes.length).fill(0));
  
  const animIndex = useSharedValue(state.index);

  useEffect(() => {
    animIndex.value = withSpring(state.index, { damping: 16, stiffness: 130 });
    
    // Tactile haptic tick triggers exactly once on tab index transition
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [state.index, animIndex]);

  const handleTabLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;
    
    const widths = [...tabWidths.value];
    widths[index] = width;
    tabWidths.value = widths;

    const offsets = [...tabOffsets.value];
    offsets[index] = x;
    tabOffsets.value = offsets;
  };

  // GPU-Driven Elastic Sliding Bubble Style using scaleX to avoid layout engine thrashing
  const capsuleStyle = useAnimatedStyle(() => {
    const widths = tabWidths.value;
    const offsets = tabOffsets.value;
    const activeIdx = state.index;

    const currentX = withSpring(offsets[activeIdx] ?? 0, { damping: 16, stiffness: 130 });
    const currentWidth = widths[activeIdx] ?? 72;

    // Calculate moving delta to stretch the capsule dynamically during transition
    const travelDelta = Math.abs(animIndex.value - activeIdx);

    return {
      position: 'absolute',
      width: currentWidth,
      height: ACTIVE_PILL_HEIGHT,
      borderRadius: 999,
      // Premium brand-aligned visual theme blending in light/dark
      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.06)',
      borderColor: isDark ? 'rgba(220, 38, 38, 0.35)' : 'rgba(220, 38, 38, 0.15)',
      borderWidth: 1,
      transform: [
        { translateX: currentX },
        { scaleX: interpolate(travelDelta, [0, 0.5, 1], [1, 1.25, 1], Extrapolation.CLAMP) }
      ],
      zIndex: 1,
    };
  });

  return (
    <View style={styles.outerContainer} testID="custom-tab-bar-wrapper">
      <View
        testID="custom-tab-bar"
        style={[
          styles.tabBarContainer,
          {
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      >
        {/* Sliding background active capsule */}
        <Animated.View style={capsuleStyle} testID="custom-tab-bar-capsule" />

        {visibleRoutes.map((route, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onLayout={handleTabLayout(index)}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.title || route.name}
              testID={`custom-tab-item-${route.name}`}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? BRAND.primary : colors.tabIconDefault,
                size: 22,
              })}
              {options.tabBarLabel?.({
                focused: isFocused,
                color: isFocused ? BRAND.primary : colors.tabIconDefault,
              })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  tabBarContainer: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    ...getTabBarShadowStyle('native'),
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
