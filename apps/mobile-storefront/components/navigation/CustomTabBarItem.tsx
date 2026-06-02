import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BRAND } from '@/constants/Colors';

export interface CustomTabOptions {
  href?: string | null;
  title?: string;
  tabBarIcon?: (props: {
    focused: boolean;
    color: string;
    size: number;
  }) => ReactNode;
  tabBarLabel?: (props: { focused: boolean; color: string }) => ReactNode;
}

export function CustomTabBarItem({
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

const styles = StyleSheet.create({
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
