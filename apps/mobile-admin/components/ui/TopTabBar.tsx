import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { selectRuntimePlatform } from '@/config/runtime-platform';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

const TAB_TEXT_FONT_FAMILY = selectRuntimePlatform({
  android: 'sans-serif-medium',
  default: 'System',
  ios: 'System',
});

type TopTabBarProps = {
  activeTab: 'in_stock' | 'on_website';
  inStockCount?: number;
  onWebsiteCount?: number;
  onTabChange: (tab: 'in_stock' | 'on_website') => void;
};

export function TopTabBar({
  activeTab,
  inStockCount = 0,
  onTabChange,
  onWebsiteCount = 0,
}: TopTabBarProps) {
  const { colors } = useTheme();

  // 0 represents 'in_stock', 1 represents 'on_website'
  const activeIndex = useSharedValue(activeTab === 'in_stock' ? 0 : 1);

  useEffect(() => {
    activeIndex.value = withSpring(activeTab === 'in_stock' ? 0 : 1, {
      damping: 20,
      stiffness: 200,
    });
  }, [activeTab, activeIndex]);

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: `${activeIndex.value * 100}%` as unknown as number },
      ],
    };
  });

  const handlePress = (tab: 'in_stock' | 'on_website') => {
    onTabChange(tab);
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: colors.primary },
          indicatorStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: activeTab === 'in_stock' }}
        onPress={() => handlePress('in_stock')}
        style={styles.tab}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'in_stock'
              ? { color: colors.primary, fontWeight: '700' }
              : { color: colors.textSecondary },
          ]}
        >
          In Stock ({inStockCount})
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: activeTab === 'on_website' }}
        onPress={() => handlePress('on_website')}
        style={styles.tab}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'on_website'
              ? { color: colors.primary, fontWeight: '700' }
              : { color: colors.textSecondary },
          ]}
        >
          On Website ({onWebsiteCount})
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 48,
    position: 'relative',
    borderBottomWidth: 1,
  },
  indicator: {
    height: 3,
    bottom: -1,
    position: 'absolute',
    width: '50%',
    zIndex: 2,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  tabText: {
    fontFamily: TAB_TEXT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
