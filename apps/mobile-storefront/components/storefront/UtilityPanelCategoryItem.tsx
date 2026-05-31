import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { useEffect } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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
}

export function UtilityPanelCategoryItem({
  id,
  name,
  iconName,
  variant,
  isActive,
  onPress,
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
    iconScale.value = withSpring(isActive ? 1.05 : 1, {
      damping: 16,
      stiffness: 180,
      mass: 1,
    });
    labelOpacity.value = withTiming(isActive ? 1 : 0.8, {
      duration: 220,
    });
  }, [isActive, iconScale, labelOpacity]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

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
          { backgroundColor: colors.muted },
          isActive && [
            styles.circleIconActive,
            { backgroundColor: colors.card },
          ],
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
