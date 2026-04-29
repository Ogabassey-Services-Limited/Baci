import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
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
const TAB_MIN_WIDTH = 78;
const TAB_HORIZONTAL_PADDING = 12;
const TAB_CONTENT_GAP = 6;
const LABEL_FONT_SIZE = 13;

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

  return (
    <View
      accessibilityLabel="Utility service categories"
      accessibilityRole="tablist"
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {UTILITY_TYPES.map((item) => {
          const isSelected = item.type === selectedType;

          return (
            <Pressable
              key={item.type}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label} utility service`}
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={`Switch to ${item.label} utility payments`}
              onPress={() => onSelect(item.type)}
              android_ripple={{
                color: isSelected ? `${BRAND.onPrimary}24` : colors.border,
              }}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: isSelected ? BRAND.primary : colors.muted,
                  borderColor: isSelected ? BRAND.primary : colors.border,
                },
                pressed && styles.pressedTab,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={17}
                color={isSelected ? BRAND.onPrimary : colors.icon}
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
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  tab: {
    minHeight: TAB_MIN_HEIGHT,
    minWidth: TAB_MIN_WIDTH,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: TAB_HORIZONTAL_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TAB_CONTENT_GAP,
  },
  pressedTab: UTILITY_TYPE_TAB_PRESSED_STYLE,
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '700',
  },
});
