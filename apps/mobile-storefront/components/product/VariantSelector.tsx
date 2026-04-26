/**
 * Variant Selector Component
 * Advanced variant selection with color swatches and storage options
 * Supports color images, price modifiers, and stock tracking
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import { formatVariantAxisLabel, type ProductVariant } from '@/types/product';

// Common color name to hex mapping
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

function getColorHex(colorName: string): string {
  const lower = colorName.toLowerCase();

  // Direct match
  if (COLOR_HEX_MAP[lower]) {
    return COLOR_HEX_MAP[lower];
  }

  // Partial match
  for (const [key, value] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  // Default gray for unknown colors
  return '#9CA3AF';
}

interface ColorOption {
  name: string;
  value: string; // hex
  images?: string[];
}

interface StorageOption {
  value: string;
  stock?: number;
}

interface GenericAttributeOption {
  axis: string;
  values: string[];
}

interface VariantSelectorProps {
  attributes?: Record<string, string[]>;
  colors?: (string | { name: string; value: string })[];
  colorImages?: Record<string, string[]>;
  storage?: string | string[];
  variants?: ProductVariant[];
  manageStock?: boolean;
  selectedColor: string | null;
  selectedStorage: string | null;
  selectedAttributes: Record<string, string>;
  onSelectColor: (color: string, images?: string[]) => void;
  onSelectStorage: (storage: string) => void;
  onSelectAttribute: (axis: string, value: string) => void;
}

export function VariantSelector({
  attributes,
  colors,
  colorImages,
  storage,
  variants,
  manageStock,
  selectedColor,
  selectedStorage,
  selectedAttributes,
  onSelectColor,
  onSelectStorage,
  onSelectAttribute,
}: VariantSelectorProps) {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const usesManagedStock = manageStock !== false;
  const hasImageDrivenColors = Boolean(
    colorImages && Object.keys(colorImages).length > 0
  );

  // Normalize colors to ColorOption array
  const normalizedColors: ColorOption[] = [];

  if (hasImageDrivenColors) {
    // Prefer color_images mapping
    for (const [colorName, images] of Object.entries(colorImages ?? {})) {
      normalizedColors.push({
        name: colorName,
        value: getColorHex(colorName),
        images,
      });
    }
  } else if (colors && colors.length > 0) {
    // Fall back to colors array
    for (const color of colors) {
      if (typeof color === 'string') {
        normalizedColors.push({
          name: color,
          value: getColorHex(color),
        });
      } else {
        normalizedColors.push({
          name: color.name,
          value: color.value || getColorHex(color.name),
        });
      }
    }
  }

  // Normalize storage options
  const normalizedStorage: StorageOption[] = [];

  if (storage) {
    const storageArray = Array.isArray(storage) ? storage : [storage];
    const uniqueStorage = Array.from(
      new Set(storageArray.map((value) => value.trim()).filter(Boolean))
    );
    for (const s of uniqueStorage) {
      // Find matching variant for price info
      const variant = variants?.find(
        (v) => v.attributes?.storage === s || v.name?.includes(s)
      );

      normalizedStorage.push({
        value: s,
        stock: variant?.stock_quantity,
      });
    }
  }

  const genericAttributeOptions = new Map<string, Set<string>>();

  for (const [axis, values] of Object.entries(attributes ?? {})) {
    if (isInternalSelectionAxis(axis)) {
      continue;
    }

    const normalizedValues = Array.isArray(values) ? values : [values];
    const axisValues = genericAttributeOptions.get(axis) ?? new Set<string>();
    for (const value of normalizedValues) {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        axisValues.add(trimmedValue);
      }
    }
    if (axisValues.size > 0) {
      genericAttributeOptions.set(axis, axisValues);
    }
  }

  for (const variant of variants ?? []) {
    for (const [axis, value] of Object.entries(variant.attributes ?? {})) {
      if (isInternalSelectionAxis(axis)) {
        continue;
      }

      const trimmedValue = value.trim();
      if (!trimmedValue) {
        continue;
      }

      const axisValues = genericAttributeOptions.get(axis) ?? new Set<string>();
      axisValues.add(trimmedValue);
      genericAttributeOptions.set(axis, axisValues);
    }
  }

  const normalizedGenericAttributes: GenericAttributeOption[] = Array.from(
    genericAttributeOptions.entries()
  ).map(([axis, values]) => ({
    axis,
    values: Array.from(values),
  }));

  // If no colors or storage, don't render
  if (
    normalizedColors.length === 0 &&
    normalizedStorage.length === 0 &&
    normalizedGenericAttributes.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Color Selection */}
      {normalizedColors.length > 0 && !hasImageDrivenColors && (
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
                  onPress={() => onSelectColor(color.name, color.images)}
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

      {/* Storage Selection */}
      {normalizedStorage.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>
            Storage
          </Text>
          <View style={styles.storageGrid}>
            {normalizedStorage.map((option) => {
              const isSelected = selectedStorage === option.value;
              const isOutOfStock =
                usesManagedStock &&
                option.stock !== undefined &&
                option.stock === 0;
              const isLowStock =
                usesManagedStock &&
                option.stock !== undefined &&
                option.stock > 0 &&
                option.stock <= 5;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => !isOutOfStock && onSelectStorage(option.value)}
                  disabled={isOutOfStock}
                  style={[
                    styles.storageChip,
                    {
                      backgroundColor: isSelected
                        ? `${BRAND.primary}15`
                        : themeColors.card,
                      borderColor: isSelected
                        ? BRAND.primary
                        : themeColors.border,
                      opacity: isOutOfStock ? 0.5 : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.value}${isOutOfStock ? ', out of stock' : isLowStock ? `, ${option.stock} left` : ''}`}
                  accessibilityState={{
                    checked: isSelected,
                    disabled: isOutOfStock,
                  }}
                >
                  <Text
                    style={[
                      styles.storageValue,
                      {
                        color: isSelected ? BRAND.primary : themeColors.text,
                      },
                    ]}
                  >
                    {option.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {normalizedGenericAttributes.map(({ axis, values }) => {
        const selectedValue = selectedAttributes[axis] ?? null;
        const axisLabel = formatVariantAxisLabel(axis) ?? axis;

        return (
          <View key={axis} style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: themeColors.text }]}>
                {axisLabel}
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
            <View style={styles.storageGrid}>
              {values.map((value) => {
                const isSelected = selectedValue === value;

                return (
                  <Pressable
                    key={`${axis}-${value}`}
                    onPress={() => onSelectAttribute(axis, value)}
                    style={[
                      styles.storageChip,
                      {
                        backgroundColor: isSelected
                          ? `${BRAND.primary}15`
                          : themeColors.card,
                        borderColor: isSelected
                          ? BRAND.primary
                          : themeColors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${axisLabel}: ${value}`}
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text
                      style={[
                        styles.storageValue,
                        {
                          color: isSelected ? BRAND.primary : themeColors.text,
                        },
                      ]}
                    >
                      {value}
                    </Text>
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
  storageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  storageChip: {
    paddingHorizontal: SPACING.md,
    minHeight: 44, // 2026 Accessibility: Minimum 44px touch target
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 2,
    minWidth: 80,
    alignItems: 'center',
  },
  storageValue: {
    fontSize: 15,
    fontWeight: '600',
  },
});
