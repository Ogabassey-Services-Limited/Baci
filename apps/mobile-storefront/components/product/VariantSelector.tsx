/**
 * Variant Selector Component
 * Advanced variant selection with color swatches and storage options
 * Supports color images, price modifiers, and stock tracking
 */

import Ionicons from '@react-native-vector-icons/ionicons';
import { Platform, Pressable, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, withAlpha } from '@/constants/Colors';
import { formatVariantAxisLabel, type ProductVariant } from '@/types/product';
import { normalizeVariantOptions } from './VariantSelector.options';
import { getVariantColorSwatchShadowStyle } from './VariantSelector.shadows';
import { variantSelectorStyles as styles } from './VariantSelector.styles';

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
  const colorSwatchShadowStyle = getVariantColorSwatchShadowStyle(
    Platform.OS === 'web' ? 'web' : 'native'
  );
  const {
    hasImageDrivenColors,
    normalizedColors,
    normalizedStorage,
    normalizedGenericAttributes,
  } = normalizeVariantOptions({
    attributes,
    colors,
    colorImages,
    storage,
    variants,
  });

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
                    colorSwatchShadowStyle,
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
                          backgroundColor: isLight
                            ? BRAND.primary
                            : palette.white,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={isLight ? palette.white : color.value}
                      />
                    </View>
                  )}
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
                          ? withAlpha(BRAND.primary, 0.08)
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
                        ? withAlpha(BRAND.primary, 0.08)
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
    </View>
  );
}
