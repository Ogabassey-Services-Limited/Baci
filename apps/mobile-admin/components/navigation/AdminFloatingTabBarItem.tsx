import type { ReactNode } from 'react';
import {
  type Insets,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';

const TAB_HIT_SLOP: Insets = { top: 8, right: 4, bottom: 8, left: 4 };

export interface AdminFloatingTabOptions {
  href?: string | null;
  tabBarBadge?: number | string;
  tabBarIcon?: (props: {
    focused: boolean;
    color: string;
    size: number;
  }) => ReactNode;
  tabBarLabel?: (props: { focused: boolean; color: string }) => ReactNode;
  title?: string;
}

export function AdminFloatingTabBarItem({
  badge,
  colors,
  isFocused,
  label,
  onPress,
  onPressIn,
  onPressOut,
  options,
  routeName,
}: {
  badge?: number | string;
  colors: ThemeColors;
  isFocused: boolean;
  label: string;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut?: () => void;
  options: AdminFloatingTabOptions;
  routeName: string;
}) {
  const color = isFocused ? colors.primary : colors.textSecondary;
  const labelStyle: StyleProp<TextStyle> = isFocused
    ? [styles.label, { color: colors.primary }]
    : [styles.label, { color: colors.textSecondary }];

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      hitSlop={TAB_HIT_SLOP}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.tabItem}
      testID={`admin-floating-tab-${routeName}`}
    >
      <View style={styles.tabContent}>
        <View style={styles.iconSlot}>
          {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
          {badge !== undefined ? (
            <View
              style={[styles.badge, { backgroundColor: colors.notification }]}
              testID={`admin-floating-tab-badge-${routeName}`}
            >
              <Text
                numberOfLines={1}
                style={[styles.badgeText, { color: colors.textOnNotification }]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={labelStyle}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    zIndex: 2,
  },
  tabContent: {
    alignItems: 'center',
    gap: 2,
    height: '100%',
    justifyContent: 'center',
    minWidth: 0,
    paddingTop: 3,
    width: '100%',
  },
  iconSlot: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    position: 'relative',
    width: 42,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    letterSpacing: 0,
    lineHeight: 13,
    maxWidth: '100%',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -1,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    lineHeight: 13,
  },
});
