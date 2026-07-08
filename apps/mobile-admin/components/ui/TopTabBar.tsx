import { useEffect, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { selectRuntimePlatform } from '@/config/runtime-platform';
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
  /**
   * Live pager progress (page index + drag offset, 0..1). When provided the
   * indicator tracks the finger 1:1 during swipes; otherwise it springs on
   * discrete tab changes.
   */
  pagerPosition?: SharedValue<number>;
};

export function TopTabBar({
  activeTab,
  inStockCount = 0,
  onTabChange,
  onWebsiteCount = 0,
  pagerPosition,
}: TopTabBarProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  // 0 represents 'in_stock', 1 represents 'on_website'
  const activeIndex = useSharedValue(activeTab === 'in_stock' ? 0 : 1);

  useEffect(() => {
    activeIndex.value = withSpring(activeTab === 'in_stock' ? 0 : 1, {
      damping: 20,
      stiffness: 200,
    });
  }, [activeTab, activeIndex]);

  const tabWidth = containerWidth / 2;

  const indicatorStyle = useAnimatedStyle(() => {
    const position = pagerPosition
      ? pagerPosition.value
      : activeIndex.value;
    return {
      transform: [{ translateX: position * tabWidth }],
    };
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const handlePress = (tab: 'in_stock' | 'on_website') => {
    onTabChange(tab);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, { borderBottomColor: colors.border }]}
    >
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: colors.primary },
          indicatorStyle,
        ]}
      />
      <Pressable
        accessibilityLabel={`In Stock tab ${activeTab === 'in_stock' ? 'selected' : 'not selected'}`}
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
        accessibilityLabel={`On Website tab ${activeTab === 'on_website' ? 'selected' : 'not selected'}`}
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
