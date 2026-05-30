import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  TouchableOpacity,
} from 'react-native';
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
  const iconScale = useRef(new Animated.Value(isActive ? 1.05 : 1)).current;
  const labelOpacity = useRef(new Animated.Value(isActive ? 1 : 0.8)).current;
  const activeShadowStyle = getUtilityPanelActiveShadowStyle(
    Platform.OS === 'web' ? 'web' : 'native',
    colors.black
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: isActive ? 1.05 : 1,
        damping: 16,
        stiffness: 180,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: isActive ? 1 : 0.8,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, iconScale, labelOpacity]);

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
          { transform: [{ scale: iconScale }] },
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
          { opacity: labelOpacity },
        ]}
      >
        {name}
      </Animated.Text>
    </TouchableOpacity>
  );
}
