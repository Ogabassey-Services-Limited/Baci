import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING, withAlpha } from '@/constants/Colors';
import { UTILITY_TYPE_TAB_PRESSED_STYLE } from './utility-type-tabs.constants';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface UtilityTypeDefinition {
  type: string;
  label: string;
  icon: IoniconsName;
}

const UTILITY_TYPES = [
  { type: 'airtime', label: 'Airtime', icon: 'call-outline' },
  { type: 'data', label: 'Data', icon: 'wifi-outline' },
  { type: 'tv', label: 'TV', icon: 'tv-outline' },
  { type: 'power', label: 'Power', icon: 'flash-outline' },
  { type: 'gaming', label: 'Gaming', icon: 'game-controller-outline' },
] as const satisfies readonly UtilityTypeDefinition[];

const TAB_MIN_HEIGHT = 38;
const TAB_WIDTHS: Record<UtilityType, number> = {
  airtime: 96,
  data: 78,
  tv: 78,
  power: 92,
  gaming: 112,
};
const TAB_HORIZONTAL_PADDING = 12;
const TAB_ICON_MARGIN_END = 6;
const LABEL_FONT_SIZE = 13;
const TAB_SIDE_INSET = SPACING.md;
const TAB_ITEM_GAP = SPACING.sm;

export type UtilityType = (typeof UTILITY_TYPES)[number]['type'];

interface UtilityTypeTabsProps {
  selectedType: UtilityType;
  onSelect: (type: UtilityType) => void;
}

export function UtilityTypeTabs({
  selectedType,
  onSelect,
}: UtilityTypeTabsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (viewportWidth <= 0) {
      return;
    }

    const selectedIndex = UTILITY_TYPES.findIndex(
      (item) => item.type === selectedType
    );
    if (selectedIndex < 0) {
      return;
    }

    const selectedOffset = UTILITY_TYPES.slice(0, selectedIndex).reduce<number>(
      (offset, item) => offset + TAB_WIDTHS[item.type] + TAB_ITEM_GAP,
      TAB_SIDE_INSET
    );
    const selectedCenter =
      selectedOffset + TAB_WIDTHS[selectedType] / 2 - viewportWidth / 2;

    scrollRef.current?.scrollTo({
      animated: true,
      x: Math.max(0, selectedCenter),
    });
  }, [selectedType, viewportWidth]);

  return (
    <View
      accessibilityLabel="Utility service categories"
      accessibilityRole="tablist"
      testID="utility-type-tabs"
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        testID="utility-type-tabs-scroll"
      >
        {UTILITY_TYPES.map((item, index) => {
          const isSelected = item.type === selectedType;

          return (
            <Pressable
              key={item.type}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label} utility service`}
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={`Switch to ${item.label} utility payments`}
              testID={`utility-tab-${item.type}`}
              onPress={() => onSelect(item.type)}
              android_ripple={{
                color: isSelected
                  ? withAlpha(BRAND.onPrimary, 0.14)
                  : colors.border,
              }}
              style={({ pressed }) => [
                styles.tab,
                { width: TAB_WIDTHS[item.type] },
                {
                  backgroundColor: isSelected ? BRAND.primary : colors.muted,
                  borderColor: isSelected ? BRAND.primary : colors.border,
                },
                index < UTILITY_TYPES.length - 1 && styles.tabSpacing,
                pressed && styles.pressedTab,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={17}
                color={isSelected ? BRAND.onPrimary : colors.icon}
                style={styles.icon}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: isSelected ? BRAND.onPrimary : colors.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACING.sm,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: TAB_SIDE_INSET,
  },
  tab: {
    minHeight: TAB_MIN_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: TAB_HORIZONTAL_PADDING,
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSpacing: {
    marginRight: TAB_ITEM_GAP,
  },
  pressedTab: UTILITY_TYPE_TAB_PRESSED_STYLE,
  icon: {
    marginRight: TAB_ICON_MARGIN_END,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '700',
  },
});
