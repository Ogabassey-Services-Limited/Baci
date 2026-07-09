import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

export interface DeliveryMethodOption {
  id: DeliveryMethod;
  title: string;
  subtitle: string;
  helperText: string;
  icon: IoniconsIconName;
  pickupStationQuote?: ShippingQuote;
  isProviderPickup: boolean;
}

interface DeliveryMethodTabsProps {
  colors: ColorsScheme;
  isDark: boolean;
  options: DeliveryMethodOption[];
  selectedMethod: DeliveryMethod;
  onSelectMethod: (method: DeliveryMethod) => void;
}

export function DeliveryMethodTabs({
  colors,
  isDark,
  options,
  selectedMethod,
  onSelectMethod,
}: DeliveryMethodTabsProps) {
  const [railWidth, setRailWidth] = useState(0);
  const visibleOptionCount = Math.min(Math.max(options.length, 1), 3);
  const segmentGap = SPACING.sm;
  const railInnerPadding = 12;
  const segmentWidth =
    railWidth > 0
      ? Math.floor(
          (railWidth -
            railInnerPadding -
            segmentGap * (visibleOptionCount - 1)) /
            visibleOptionCount
        )
      : undefined;
  const shouldScroll = options.length > 3;
  const useStackedLayout = options.length >= 3;
  const handleRailLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== railWidth) setRailWidth(nextWidth);
  };

  return (
    <View
      onLayout={handleRailLayout}
      accessibilityRole="radiogroup"
      style={[
        styles.segmentRail,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={shouldScroll}
        contentContainerStyle={[
          styles.segmentScroller,
          !shouldScroll && styles.segmentScrollerFull,
        ]}
      >
        {options.map((option) => {
          const isSelected = selectedMethod === option.id;
          const iconColor = isSelected ? BRAND.primary : colors.textSecondary;

          return (
            <View
              key={option.id}
              style={[
                styles.segment,
                useStackedLayout && styles.segmentStacked,
                {
                  backgroundColor: isSelected
                    ? BRAND.primaryAlpha12
                    : colors.card,
                  borderColor: isSelected ? BRAND.primary : colors.border,
                  width: shouldScroll ? 132 : segmentWidth,
                },
              ]}
            >
              <Pressable
                onPress={() => onSelectMethod(option.id)}
                accessibilityRole="radio"
                accessibilityLabel={`Select ${option.title}`}
                accessibilityState={{ checked: isSelected }}
                style={[
                  styles.segmentPressable,
                  useStackedLayout && styles.segmentPressableStacked,
                ]}
              >
                <View
                  style={[
                    styles.segmentContent,
                    useStackedLayout && styles.segmentContentStacked,
                  ]}
                >
                  <View
                    style={[
                      styles.segmentIcon,
                      {
                        backgroundColor: isSelected
                          ? BRAND.primaryAlpha12
                          : `${colors.textSecondary}10`,
                      },
                    ]}
                  >
                    <Ionicons name={option.icon} size={18} color={iconColor} />
                  </View>
                  <Text
                    numberOfLines={useStackedLayout ? 2 : 1}
                    style={[
                      styles.segmentTitle,
                      useStackedLayout && styles.segmentTitleStacked,
                      { color: isSelected ? BRAND.primary : colors.text },
                    ]}
                  >
                    {option.title}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRail: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    padding: 6,
  },
  segmentScroller: { gap: SPACING.sm },
  segmentScrollerFull: { flexGrow: 1 },
  segment: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    minHeight: 66,
    overflow: 'hidden',
  },
  segmentStacked: { minHeight: 88 },
  segmentPressable: { flex: 1, justifyContent: 'center', padding: 9 },
  segmentPressableStacked: { paddingHorizontal: 6, paddingVertical: 9 },
  segmentContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  segmentContentStacked: {
    flexDirection: 'column',
    gap: 6,
    justifyContent: 'center',
  },
  segmentIcon: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: 32,
    justifyContent: 'center',
    width: 31,
  },
  segmentTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
    textAlign: 'left',
  },
  segmentTitleStacked: {
    flex: 0,
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
  },
});
