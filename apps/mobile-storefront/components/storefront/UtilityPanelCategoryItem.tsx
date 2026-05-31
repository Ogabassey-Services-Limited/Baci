import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { useEffect } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { getUtilityPanelActiveShadowStyle } from './UtilityPanel.shadows';
import { utilityPanelStyles as styles } from './UtilityPanel.styles';

interface UtilityPanelCategoryItemProps {
  id: string;
  name: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  variant: 'card' | 'circle' | 'pill';
  isActive: boolean;
  onPress: () => void;
  activeIndex?: SharedValue<number>;
  index?: number;
}

export function UtilityPanelCategoryItem({
  id,
  name,
  iconName,
  variant,
  isActive,
  onPress,
  activeIndex,
  index,
}: UtilityPanelCategoryItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const iconScale = useSharedValue(isActive ? 1.05 : 1);
  const labelOpacity = useSharedValue(isActive ? 1 : 0.8);
  const activeShadowStyle = getUtilityPanelActiveShadowStyle(
    Platform.OS === 'web' ? 'web' : 'native',
    colors.black
  );

  useEffect(() => {
    // Only run discrete spring animations if activeIndex is not driving the continuous flow
    if (activeIndex === undefined || index === undefined) {
      iconScale.value = withSpring(isActive ? 1.05 : 1, {
        damping: 16,
        stiffness: 180,
        mass: 1,
      });
      labelOpacity.value = withTiming(isActive ? 1 : 0.8, {
        duration: 220,
      });
    }
  }, [isActive, iconScale, labelOpacity, activeIndex, index]);

  const animatedIconStyle = useAnimatedStyle(() => {
    if (activeIndex !== undefined && index !== undefined) {
      const isCurrentlyActive = Math.round(activeIndex.value) === index;
      const progress = isCurrentlyActive ? 1 : 0;

      return {
        transform: [{ scale: 1 + progress * 0.05 }],
        backgroundColor: progress === 1 ? colors.card : colors.muted,
        borderColor: progress === 1 ? BRAND.primary : 'transparent',
        borderWidth: progress === 1 ? 1 : 0,
      };
    }

    return {
      transform: [{ scale: iconScale.value }],
      backgroundColor: isActive ? colors.card : colors.muted,
      borderColor: isActive ? BRAND.primary : 'transparent',
      borderWidth: isActive ? 1 : 0,
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    if (activeIndex !== undefined && index !== undefined) {
      const isCurrentlyActive = Math.round(activeIndex.value) === index;
      return {
        opacity: isCurrentlyActive ? 1 : 0.8,
      };
    }

    return {
      opacity: labelOpacity.value,
    };
  });

  if (variant !== 'circle') {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.circleItem}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={name}
      accessibilityHint={`Tap to select ${name} services`}
    >
      <Animated.View
        testID={`utility-category-icon-${id}`}
        style={[
          styles.circleIcon,
          isActive && activeShadowStyle,
          animatedIconStyle,
        ]}
      >
        <Ionicons
          name={iconName}
          size={20}
          color={isActive ? BRAND.primary : colors.icon}
        />
      </Animated.View>
      <Animated.Text
        style={[
          styles.circleLabel,
          { color: colors.textSecondary },
          isActive && [styles.circleLabelActive, { color: colors.text }],
          animatedLabelStyle,
        ]}
      >
        {name}
      </Animated.Text>
    </TouchableOpacity>
  );
}
