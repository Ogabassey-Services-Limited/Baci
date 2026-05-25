/**
 * Filter Sheet Component
 * Bottom sheet with price range filter matching web platform
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { palette, withAlpha } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import styles from './FilterSheet.styles';
import { FilterSheetPresets } from './FilterSheetPresets';

const MAX_PRICE_CEILING = 3_000_000;

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  minPrice: number;
  maxPrice: number;
  onApplyFilter: (min: number, max: number) => void;
}

export function FilterSheet({
  visible,
  onClose,
  minPrice,
  maxPrice,
  onApplyFilter,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [tempMinPrice, setTempMinPrice] = useState(minPrice.toString());
  const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice.toString());
  const { colors, isDark } = useTheme();

  // M10 FIX: Sync local state when prop values change from parent
  useEffect(() => {
    setTempMinPrice(minPrice.toString());
  }, [minPrice]);

  useEffect(() => {
    setTempMaxPrice(maxPrice.toString());
  }, [maxPrice]);

  const handleApply = () => {
    const min = tempMinPrice === '' ? 0 : Number(tempMinPrice);
    const max =
      tempMaxPrice === '' ? MAX_PRICE_CEILING : Number(tempMaxPrice);
    onApplyFilter(min, max);
    onClose();
  };

  const handleReset = () => {
    setTempMinPrice('0');
    setTempMaxPrice(MAX_PRICE_CEILING.toString());
    onApplyFilter(0, MAX_PRICE_CEILING);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      // 2026 Accessibility: Trap focus within modal for screen readers
      accessibilityViewIsModal={true}
    >
      {/* M14 FIX: Separate backdrop from sheet content so tapping inside sheet does not close it */}
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: withAlpha(palette.black, isDark ? 0.8 : 0.5),
          },
        ]}
      >
        <TouchableWithoutFeedback
          onPress={onClose}
          accessibilityLabel="Close filter backdrop"
          accessibilityRole="button"
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <AppKeyboardContainer
          style={[
            styles.keyboardAvoidingView,
            { pointerEvents: 'box-none' },
          ]}
        >
          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            style={[
              styles.sheet,
              {
                paddingBottom: insets.bottom + 20,
                backgroundColor: colors.card,
              },
            ]}
            accessible={true}
            accessibilityLabel="Filter by price dialog"
            accessibilityViewIsModal={true}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text
                style={[styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                Filter by Price
              </Text>
              <Pressable
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.muted }]}
                accessibilityLabel="Close filter"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color={colors.icon} />
              </Pressable>
            </View>

            {/* Price Inputs */}
            <View style={styles.content}>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.label, { color: colors.textSecondary }]}
                    nativeID="minPriceLabel"
                  >
                    Min Price
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.currency, { color: colors.textSecondary }]}
                      importantForAccessibility="no"
                    >
                      ₦
                    </Text>
                    <TextInput
                      value={tempMinPrice}
                      onChangeText={setTempMinPrice}
                      keyboardType="number-pad"
                      placeholder="0"
                      style={[styles.input, { color: colors.text }]}
                      placeholderTextColor={colors.placeholder}
                      accessibilityLabel="Minimum price in Naira"
                      accessibilityHint="Enter the minimum price for filtering products"
                      accessibilityLabelledBy="minPriceLabel"
                      // BUG-5-005: focus price input on open
                      autoFocus
                    />
                  </View>
                </View>

                <Text
                  style={[styles.separator, { color: colors.textSecondary }]}
                  importantForAccessibility="no"
                >
                  -
                </Text>

                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.label, { color: colors.textSecondary }]}
                    nativeID="maxPriceLabel"
                  >
                    Max Price
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.currency, { color: colors.textSecondary }]}
                      importantForAccessibility="no"
                    >
                      ₦
                    </Text>
                    <TextInput
                      value={tempMaxPrice}
                      onChangeText={setTempMaxPrice}
                      keyboardType="number-pad"
                      placeholder={MAX_PRICE_CEILING.toString()}
                      style={[styles.input, { color: colors.text }]}
                      placeholderTextColor={colors.placeholder}
                      accessibilityLabel="Maximum price in Naira"
                      accessibilityHint="Enter the maximum price for filtering products"
                      accessibilityLabelledBy="maxPriceLabel"
                    />
                  </View>
                </View>
              </View>

              <FilterSheetPresets
                colors={{
                  border: colors.border,
                  muted: colors.muted,
                  textSecondary: colors.textSecondary,
                }}
                onSelectRange={(min, max) => {
                  setTempMinPrice(min);
                  setTempMaxPrice(max);
                }}
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={styles.resetButton}
                onPress={handleReset}
                accessibilityLabel="Reset price filter"
                accessibilityRole="button"
              >
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
              <Pressable
                style={styles.applyButton}
                onPress={handleApply}
                accessibilityLabel="Apply price filter"
                accessibilityRole="button"
              >
                <Text style={styles.applyText}>Apply Filter</Text>
              </Pressable>
            </View>
          </Animated.View>
        </AppKeyboardContainer>
      </View>
    </Modal>
  );
}
