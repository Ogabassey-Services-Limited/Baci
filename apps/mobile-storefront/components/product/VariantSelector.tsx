/**
 * Variant Selector Component
 * Advanced variant selection with color swatches and generic option axes.
 */

import { Ionicons } from '@expo/vector-icons';
import { canonicalizeVariantAxis, formatVariantAxisLabel } from '@baci/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import type { SelectedProductAttributes } from '@/lib/storefront-product-selection';
import { findMatchingProductVariant } from '@/lib/storefront-product-selection';
import { formatPrice, type ProductVariant } from '@/types/product';

const COLOR_HEX_MAP: Record<string, string> = {
  black: '#1a1a1a',
  'space black': '#1a1a1a',
  'midnight black': '#0d0d0d',
  white: '#FFFFFF',
  silver: '#C0C0C0',
  gold: '#F5E0C3',
  'rose gold': '#E8B4A0',
  blue: '#3B82F6',
  'sierra blue': '#69ABCE',
  'pacific blue': '#2D5F7C',
  'deep purple': '#6B21A8',
  purple: '#9333EA',
  red: '#EF4444',
  'product red': '#EF4444',
  green: '#22C55E',
  'alpine green': '#505E48',
  yellow: '#FCD34D',
  orange: '#FB923C',
  pink: '#EC4899',
  gray: '#6B7280',
  graphite: '#4A4A4A',
  'natural titanium': '#8A8D8F',
  'blue titanium': '#3F4E57',
  'black titanium': '#3D3D3D',
  'white titanium': '#E8E8E8',
};
const COLOR_MATCH_KEYS = Object.keys(COLOR_HEX_MAP).sort(
  (left, right) => right.length - left.length
);
const COLOR_MATCHERS = COLOR_MATCH_KEYS.map((key) => ({
  key,
  matcher: new RegExp(
    `(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`
  ),
}));
const LOW_STOCK_THRESHOLD = 5;

interface ColorOption {
  images?: string[];
  name: string;
  value: string;
}

interface AxisOptionState {
  priceModifier?: number;
  priceOverride?: number;
  stock?: number;
  value: string;
}

interface VariantSelectorProps {
  attributeAxes?: string[];
  attributeOptions?: Record<string, string[]>;
  basePrice: number;
  colorImages?: Record<string, string[]>;
  colorOptions?: string[];
  onSelectAttribute: (axis: string, value: string, images?: string[]) => void;
  selectedAttributes: SelectedProductAttributes;
  variants?: ProductVariant[];
}

function getColorHex(colorName: string) {
  const lower = colorName.toLowerCase();

  if (COLOR_HEX_MAP[lower]) {
    return COLOR_HEX_MAP[lower];
  }

  for (const { key, matcher } of COLOR_MATCHERS) {
    if (matcher.test(lower)) {
      return COLOR_HEX_MAP[key];
    }
  }

  return '#9CA3AF';
}

function withAlpha(color: string, alpha: number, fallbackColor: string) {
  const normalizedColor = color.trim();
  const hexMatch = normalizedColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (!hexMatch) {
    return fallbackColor;
  }

  const hexValue = hexMatch[1];
  const expandedHex =
    hexValue.length === 3
      ? hexValue
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : hexValue;

  const red = Number.parseInt(expandedHex.slice(0, 2), 16);
  const green = Number.parseInt(expandedHex.slice(2, 4), 16);
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return fallbackColor;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function VariantSelector({
  attributeAxes,
  attributeOptions,
  basePrice,
  colorImages,
  colorOptions,
  onSelectAttribute,
  selectedAttributes,
  variants,
}: VariantSelectorProps) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const normalizedColors: ColorOption[] = [];

  if (colorImages && Object.keys(colorImages).length > 0) {
    for (const [colorName, images] of Object.entries(colorImages)) {
      normalizedColors.push({
        name: colorName,
        value: getColorHex(colorName),
        images,
      });
    }
  } else if (colorOptions && colorOptions.length > 0) {
    for (const colorName of colorOptions) {
      normalizedColors.push({
        name: colorName,
        value: getColorHex(colorName),
      });
    }
  }

  const axisState: Record<string, AxisOptionState[]> = {};
  const renderableAxes = (attributeAxes || []).filter(
    (axis) => canonicalizeVariantAxis(axis) !== 'color'
  );

  for (const axis of renderableAxes) {
    const options = attributeOptions?.[axis] || [];
    axisState[axis] = options.map((value) => {
      const candidateVariant = findMatchingProductVariant(variants, {
        ...selectedAttributes,
        [axis]: value,
      });

      return {
        value,
        priceModifier: candidateVariant?.price_modifier,
        priceOverride: candidateVariant?.price_override,
        stock: candidateVariant?.stock_quantity,
      };
    });
  }

  if (
    normalizedColors.length === 0 &&
    Object.values(axisState).every((options) => options.length === 0)
  ) {
    return null;
  }

  const selectedColor = selectedAttributes.color ?? null;

  return (
    <View style={styles.container}>
      {normalizedColors.length > 0 && (
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: themeColors.text }]}>
              Color
            </Text>
            {selectedColor && (
              <Text
                style={[
                  styles.selectedLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                {selectedColor}
              </Text>
            )}
          </View>
          <View style={styles.colorGrid}>
            {normalizedColors.map((color) => {
              const isSelected = selectedColor === color.name;
              const isLight =
                color.value.toLowerCase() === '#ffffff' ||
                color.value.toLowerCase() === '#fff';

              return (
                <Pressable
                  key={color.name}
                  onPress={() =>
                    onSelectAttribute('color', color.name, color.images)
                  }
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color.value,
                      borderColor: isSelected
                        ? BRAND.primary
                        : isLight
                          ? themeColors.border
                          : 'transparent',
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={color.name}
                  accessibilityState={{ checked: isSelected }}
                  hitSlop={10}
                >
                  {isSelected && (
                    <View
                      style={[
                        styles.checkmark,
                        {
                          backgroundColor: isLight ? BRAND.primary : '#FFF',
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={isLight ? '#FFF' : color.value}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {renderableAxes.map((axis) => {
        const options = axisState[axis] || [];
        if (options.length === 0) {
          return null;
        }

        const selectedValue = selectedAttributes[axis] ?? null;

        return (
          <View key={axis} style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: themeColors.text }]}>
                {formatVariantAxisLabel(axis)}
              </Text>
              {selectedValue && (
                <Text
                  style={[
                    styles.selectedLabel,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  {selectedValue}
                </Text>
              )}
            </View>
            <View accessibilityRole="radiogroup" style={styles.optionGrid}>
              {options.map((option) => {
                const isSelected = selectedValue === option.value;
                const displayPrice =
                  option.priceOverride != null
                    ? option.priceOverride
                    : option.priceModifier != null
                      ? basePrice + option.priceModifier
                      : null;
                const isOutOfStock =
                  option.stock !== undefined && option.stock === 0;
                const isLowStock =
                  option.stock !== undefined &&
                  option.stock > 0 &&
                  option.stock <= LOW_STOCK_THRESHOLD;

                return (
                  <Pressable
                    key={`${axis}-${option.value}`}
                    onPress={() => onSelectAttribute(axis, option.value)}
                    disabled={isOutOfStock}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: isSelected
                          ? withAlpha(BRAND.primary, 0.08, themeColors.card)
                          : themeColors.card,
                        borderColor: isSelected
                          ? BRAND.primary
                          : themeColors.border,
                        opacity: isOutOfStock ? 0.5 : 1,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${formatVariantAxisLabel(axis)}: ${option.value}`}
                    accessibilityState={{
                      checked: isSelected,
                      disabled: isOutOfStock,
                    }}
                  >
                    <Text
                      style={[
                        styles.optionValue,
                        {
                          color: isSelected ? BRAND.primary : themeColors.text,
                        },
                      ]}
                    >
                      {option.value}
                    </Text>
                    {displayPrice != null && (
                      <Text
                        style={[
                          styles.optionPrice,
                          {
                            color: isSelected
                              ? BRAND.primary
                              : themeColors.textSecondary,
                          },
                        ]}
                      >
                        {formatPrice(displayPrice)}
                      </Text>
                    )}
                    {isLowStock && (
                      <Text style={styles.lowStockText}>
                        {option.stock} left
                      </Text>
                    )}
                    {isOutOfStock && (
                      <Text style={styles.outOfStockText}>Out of stock</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },
  section: {
    gap: SPACING.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionChip: {
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 2,
    minWidth: 80,
    alignItems: 'center',
  },
  optionValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  lowStockText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },
  outOfStockText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 2,
  },
});
