import { useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  UIManager,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { getTabBarShadowStyle } from '@/components/navigation/TabBar.shadows';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Safe check to verify if native expo-blur is compiled into the running binary.
// This prevents "Unimplemented component: <ViewManagerAdapter_ExpoBlurView>" crash
// when running on a dev client that hasn't been rebuilt/linked yet.
const HAS_EXPO_BLUR = UIManager.hasViewManagerConfig('ExpoBlurView');
const BlurContainer = HAS_EXPO_BLUR ? BlurView : View;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAPSULE_WIDTH = 36;
const CAPSULE_HEIGHT = 36;

// Horizontal spacing: left/right margins (16 * 2 = 32) + container paddingHorizontal (8 * 2 = 16) = 48
const TAB_BAR_CONTENT_WIDTH = SCREEN_WIDTH - 48;

// Strict typing for custom Expo Router navigation options
interface CustomTabOptions {
  href?: string | null;
  title?: string;
  tabBarIcon?: (props: {
    focused: boolean;
    color: string;
    size: number;
  }) => React.ReactNode;
  tabBarLabel?: (props: { focused: boolean; color: string }) => React.ReactNode;
}

// Sub-component for each tab item - kept static and vector-sharp to prevent icon pixelation
function TabItem({
  route,
  isFocused,
  options,
  colors,
  onPress,
  onPressIn,
}: {
  route: { name: string; key: string };
  isFocused: boolean;
  options: CustomTabOptions;
  colors: { tabIconDefault: string };
  onPress: () => void;
  onPressIn: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.title || route.name}
      testID={`custom-tab-item-${route.name}`}
    >
      <View style={styles.tabItemContent}>
        {options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? BRAND.primary : colors.tabIconDefault,
          size: 22,
        })}
        {options.tabBarLabel?.({
          focused: isFocused,
          color: isFocused ? BRAND.primary : colors.tabIconDefault,
        })}
      </View>
    </Pressable>
  );
}

export function CustomTabBar(props: BottomTabBarProps) {
  const activeRouteName = props.state.routes[props.state.index]?.name ?? '';

  if (activeRouteName === 'cart') {
    return null;
  }

  return <CustomTabBarChrome {...props} activeRouteName={activeRouteName} />;
}

function CustomTabBarChrome({
  state,
  descriptors,
  navigation,
  activeRouteName,
}: BottomTabBarProps & { activeRouteName: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  // Filter visible routes (ignore options.href === null and categories)
  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key] as unknown as {
      options: CustomTabOptions;
    };
    return options.href !== null && route.name !== 'categories';
  });

  const tabWidth = TAB_BAR_CONTENT_WIDTH / visibleRoutes.length;

  const activeIdx = visibleRoutes.findIndex((r) => r.name === activeRouteName);
  const targetIdx = activeIdx !== -1 ? activeIdx : 0;

  const animIndex = useSharedValue(targetIdx);
  const targetIndex = useSharedValue(targetIdx);
  const capsuleScale = useSharedValue(1);

  useEffect(() => {
    // Sync animated index if state updates independently (e.g. swipes, hardware back buttons)
    if (targetIdx === targetIndex.value) {
      return;
    }

    targetIndex.value = targetIdx;
    animIndex.value = withSpring(targetIdx, {
      damping: 11,
      stiffness: 145,
      mass: 0.8,
    });

    // Apple Liquid Glass: Lens scale-up magnification pulse on landing
    capsuleScale.value = withSpring(
      1.15,
      { damping: 9, stiffness: 220 },
      (finished) => {
        if (finished) {
          capsuleScale.value = withSpring(1.0, { damping: 12, stiffness: 140 });
        }
      }
    );

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [targetIdx, animIndex, capsuleScale, targetIndex]);

  // GPU-Driven Liquid squash-and-stretch dynamic active indicator
  const capsuleStyle = useAnimatedStyle(() => {
    const currentPos = animIndex.value;
    const target = targetIndex.value;
    const distance = Math.abs(target - currentPos);

    // Liquid Water squash-and-stretch: stretch horizontally & compress vertically in mid-transit
    // When practically at rest (distance < 0.005), force exact 1:1 scale ratios to guarantee a perfect 3D glass circle shape (no sub-pixel float deviations)
    const isAtRest = distance < 0.005;
    const stretchX = isAtRest ? 1 : 1 + Math.min(distance * 0.38, 0.3); // Stretches up to 1.3x
    const shrinkY = isAtRest ? 1 : 1 - Math.min(distance * 0.12, 0.1); // Contracts down to 0.9x to preserve visual mass/volume

    // Center capsule inside equal-width tab item
    const centerOffset = (tabWidth - CAPSULE_WIDTH) / 2;
    const translateX = currentPos * tabWidth + centerOffset + 8; // Center shift offset (+8px)

    return {
      position: 'absolute',
      width: CAPSULE_WIDTH,
      height: CAPSULE_HEIGHT,
      // Perfectly center vertically behind the active tab icon container.
      // - paddingTop of tabItemContent = 8px.
      // - height of TabBarIcon container = 32px.
      // - 22px vector icon is centered inside the 32px height container.
      // - Therefore, icon center is mathematically at y = 8 + (32 / 2) = 24px.
      // - Since the capsule height is 36px, setting top to 6px places the capsule center at exactly y = 6 + (36 / 2) = 24px.
      // - This perfect center alignment also separates the capsule border from the container's top border to prevent overlapping line glitches/white dashes.
      top: 6,
      borderRadius: CAPSULE_WIDTH / 2, // Perfect circle shape
      // Apple 3D Liquid Glass Red Sphere: glossy brand-red backing & refraction borders
      backgroundColor: isDark
        ? 'rgba(220, 38, 38, 0.18)'
        : 'rgba(220, 38, 38, 0.08)',
      borderColor: isDark
        ? 'rgba(220, 38, 38, 0.45)'
        : 'rgba(220, 38, 38, 0.28)',
      borderWidth: 1, // Whole number border width avoids sub-pixel anti-aliasing border artifacts (e.g. white dashes)

      // Floating physical shadow colored by the brand red glow
      shadowColor: BRAND.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.38 : 0.14,
      shadowRadius: 5,
      elevation: 2,

      transform: [
        { translateX },
        { scaleX: stretchX * capsuleScale.value },
        { scaleY: shrinkY * capsuleScale.value },
      ] as ViewStyle['transform'],
      zIndex: 1,
    };
  });

  return (
    <View style={styles.outerContainer} testID="custom-tab-bar-wrapper">
      <BlurContainer
        intensity={Platform.OS === 'ios' ? 70 : 85} // Premium dynamic iOS-first glass blur intensity
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.tabBarContainer,
          {
            backgroundColor: isDark
              ? HAS_EXPO_BLUR
                ? 'rgba(24, 24, 27, 0.68)' // Deep rich dark translucent backing
                : 'rgba(24, 24, 27, 0.92)' // Safe dark solid backing fallback
              : HAS_EXPO_BLUR
                ? 'rgba(255, 255, 255, 0.72)' // Elegant light translucent backing
                : 'rgba(255, 255, 255, 0.95)', // Safe light solid backing fallback
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
        testID="custom-tab-bar"
      >
        {/* Sliding background active 3D red glass circle indicator */}
        <Animated.View style={capsuleStyle} testID="custom-tab-bar-capsule" />

        {visibleRoutes.map((route, index: number) => {
          const { options } = descriptors[route.key];
          const customOptions = options as CustomTabOptions;
          const isFocused = activeRouteName === route.name;

          // Instant slide and capsule magnify pop starting at 0ms on finger touch (onPressIn)
          const handlePressIn = () => {
            if (!isFocused) {
              targetIndex.value = index;
              animIndex.value = withSpring(index, {
                damping: 11,
                stiffness: 145,
                mass: 0.8,
              });

              // Touch-slide magnifying glass pulse
              capsuleScale.value = withSpring(
                1.15,
                { damping: 9, stiffness: 220 },
                (finished) => {
                  if (finished) {
                    capsuleScale.value = withSpring(1.0, {
                      damping: 12,
                      stiffness: 140,
                    });
                  }
                }
              );

              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          };

          // Heavy navigation state swap runs on finger release (onPress)
          const handlePress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              targetIndex.value = targetIdx;
              animIndex.value = withSpring(targetIdx, {
                damping: 11,
                stiffness: 145,
                mass: 0.8,
              });
              capsuleScale.value = withSpring(1.0, {
                damping: 12,
                stiffness: 140,
              });
              return;
            }

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={customOptions}
              colors={colors}
              onPress={handlePress}
              onPressIn={handlePressIn}
            />
          );
        })}
      </BlurContainer>
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
    borderRadius: 999, // Matches capsule radius for high-fidelity shadow casting
    ...getTabBarShadowStyle('native'), // Shifted shadow here to bypass overflow:hidden clipping on BlurView
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
    overflow: 'hidden', // Enforces perfect clipping of the backdrop BlurView inside the pill
  },
  tabItem: {
    flex: 1,
    height: '100%',
    zIndex: 2,
  },
  tabItemContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    height: '100%',
    width: '100%',
  },
});
