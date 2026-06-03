import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
  onPressOut,
}: {
  route: { name: string; key: string };
  isFocused: boolean;
  options: CustomTabOptions;
  colors: { tabIconDefault: string; tabIconSelected: string };
  onPress: () => void;
  onPressIn: () => void;
  onPressOut?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.title || route.name}
      testID={`custom-tab-item-${route.name}`}
      unstable_pressDelay={0}
    >
      <View style={styles.tabItemContent}>
        {options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? colors.tabIconSelected : colors.tabIconDefault,
          size: 22,
        })}
        {options.tabBarLabel?.({
          focused: isFocused,
          color: isFocused ? colors.tabIconSelected : colors.tabIconDefault,
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
    paddingTop: 6,
    height: '100%',
    width: '100%',
  },
});
