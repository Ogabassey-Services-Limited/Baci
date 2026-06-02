import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  UIManager,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { getTabBarShadowStyle } from '@/components/navigation/TabBar.shadows';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import {
  CustomTabBarItem,
  type CustomTabOptions,
} from './CustomTabBarItem';

const HAS_EXPO_BLUR = UIManager.hasViewManagerConfig('ExpoBlurView');
const BlurContainer = HAS_EXPO_BLUR ? BlurView : View;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAPSULE_WIDTH = 36;
const CAPSULE_HEIGHT = 36;
const TAB_BAR_CONTENT_WIDTH = SCREEN_WIDTH - 48;

export function CustomTabBarChrome({
  state,
  descriptors,
  navigation,
  activeRouteName,
}: BottomTabBarProps & { activeRouteName: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

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
    if (targetIdx === targetIndex.value) {
      return;
    }

    targetIndex.value = targetIdx;
    animIndex.value = withSpring(targetIdx, {
      damping: 11,
      stiffness: 145,
      mass: 0.8,
    });

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

  const capsuleStyle = useAnimatedStyle(() => {
    const currentPos = animIndex.value;
    const target = targetIndex.value;
    const distance = Math.abs(target - currentPos);
    const isAtRest = distance < 0.005;
    const stretchX = isAtRest ? 1 : 1 + Math.min(distance * 0.38, 0.3);
    const shrinkY = isAtRest ? 1 : 1 - Math.min(distance * 0.12, 0.1);
    const centerOffset = (tabWidth - CAPSULE_WIDTH) / 2;
    const translateX = currentPos * tabWidth + centerOffset + 8;

    return {
      position: 'absolute',
      width: CAPSULE_WIDTH,
      height: CAPSULE_HEIGHT,
      top: 6,
      borderRadius: CAPSULE_WIDTH / 2,
      backgroundColor: isDark
        ? 'rgba(220, 38, 38, 0.18)'
        : 'rgba(220, 38, 38, 0.08)',
      borderColor: isDark
        ? 'rgba(220, 38, 38, 0.45)'
        : 'rgba(220, 38, 38, 0.28)',
      borderWidth: 1,
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
        intensity={Platform.OS === 'ios' ? 70 : 85}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.tabBarContainer,
          {
            backgroundColor: isDark
              ? HAS_EXPO_BLUR
                ? 'rgba(24, 24, 27, 0.68)'
                : 'rgba(24, 24, 27, 0.92)'
              : HAS_EXPO_BLUR
                ? 'rgba(255, 255, 255, 0.72)'
                : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
        testID="custom-tab-bar"
      >
        <Animated.View style={capsuleStyle} testID="custom-tab-bar-capsule" />

        {visibleRoutes.map((route, index: number) => {
          const { options } = descriptors[route.key];
          const customOptions = options as CustomTabOptions;
          const isFocused = activeRouteName === route.name;

          const handlePressIn = () => {
            if (!isFocused) {
              targetIndex.value = index;
              animIndex.value = withSpring(index, {
                damping: 11,
                stiffness: 145,
                mass: 0.8,
              });

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
            <CustomTabBarItem
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
    borderRadius: 999,
    ...getTabBarShadowStyle('native'),
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
    overflow: 'hidden',
  },
});
