/**
 * Filter Sheet Component
 * Bottom sheet with price range filter matching web platform
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';

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

  // M10 FIX: Sync local state when prop values change from parent
  useEffect(() => {
    setTempMinPrice(minPrice.toString());
  }, [minPrice]);

  useEffect(() => {
    setTempMaxPrice(maxPrice.toString());
  }, [maxPrice]);

  const handleApply = () => {
    const min = tempMinPrice === '' ? 0 : Number(tempMinPrice);
    const max = tempMaxPrice === '' ? 3000000 : Number(tempMaxPrice);
    onApplyFilter(min, max);
    onClose();
  };

  const handleReset = () => {
    setTempMinPrice('0');
    setTempMaxPrice('3000000');
    onApplyFilter(0, 3000000);
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
      <View style={styles.overlay}>
        <TouchableWithoutFeedback
          onPress={onClose}
          accessibilityLabel="Close filter backdrop"
          accessibilityRole="button"
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
          style={styles.keyboardAvoidingView}
        >
          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
            accessible={true}
            accessibilityLabel="Filter by price dialog"
            accessibilityViewIsModal={true}
          >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Filter by Price
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close filter"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          {/* Price Inputs */}
          <View style={styles.content}>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.label} nativeID="minPriceLabel">
                  Min Price
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currency} importantForAccessibility="no">
                    ₦
                  </Text>
                  <TextInput
                    value={tempMinPrice}
                    onChangeText={setTempMinPrice}
                    keyboardType="number-pad"
                    placeholder="0"
                    style={styles.input}
                    placeholderTextColor="#999"
                    accessibilityLabel="Minimum price in Naira"
                    accessibilityHint="Enter the minimum price for filtering products"
                    accessibilityLabelledBy="minPriceLabel"
                    // biome-ignore lint/a11y/noAutofocus: BUG-5-005: focus price input on open
                    autoFocus={true}
                  />
                </View>
              </View>

              <Text style={styles.separator} importantForAccessibility="no">
                -
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label} nativeID="maxPriceLabel">
                  Max Price
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currency} importantForAccessibility="no">
                    ₦
                  </Text>
                  <TextInput
                    value={tempMaxPrice}
                    onChangeText={setTempMaxPrice}
                    keyboardType="number-pad"
                    placeholder="3000000"
                    style={styles.input}
                    placeholderTextColor="#999"
                    accessibilityLabel="Maximum price in Naira"
                    accessibilityHint="Enter the maximum price for filtering products"
                    accessibilityLabelledBy="maxPriceLabel"
                  />
                </View>
              </View>
            </View>

            {/* Quick Price Presets */}
            <View style={styles.presets}>
              <Text style={styles.presetsLabel}>Quick Select:</Text>
              <View
                style={styles.presetButtons}
                accessibilityRole="summary"
                accessibilityLabel="Quick price range presets"
              >
                <Pressable
                  style={styles.presetButton}
                  onPress={() => {
                    setTempMinPrice('0');
                    setTempMaxPrice('50000');
                  }}
                  accessibilityLabel="Under 50,000 Naira"
                  accessibilityRole="button"
                >
                  <Text style={styles.presetText}>Under ₦50k</Text>
                </Pressable>
                <Pressable
                  style={styles.presetButton}
                  onPress={() => {
                    setTempMinPrice('50000');
                    setTempMaxPrice('150000');
                  }}
                  accessibilityLabel="50,000 to 150,000 Naira"
                  accessibilityRole="button"
                >
                  <Text style={styles.presetText}>₦50k - ₦150k</Text>
                </Pressable>
                <Pressable
                  style={styles.presetButton}
                  onPress={() => {
                    setTempMinPrice('150000');
                    setTempMaxPrice('300000');
                  }}
                  accessibilityLabel="150,000 to 300,000 Naira"
                  accessibilityRole="button"
                >
                  <Text style={styles.presetText}>₦150k - ₦300k</Text>
                </Pressable>
                <Pressable
                  style={styles.presetButton}
                  onPress={() => {
                    setTempMinPrice('300000');
                    setTempMaxPrice('3000000');
                  }}
                  accessibilityLabel="Above 300,000 Naira"
                  accessibilityRole="button"
                >
                  <Text style={styles.presetText}>Above ₦300k</Text>
                </Pressable>
              </View>
            </View>
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingTop: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: 'Inter_700Bold',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: '#4B5563', // gray-600 for WCAG AA contrast
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  currency: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    color: '#4B5563', // gray-600 for WCAG AA contrast
    marginRight: SPACING.xs,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    color: '#1a1a1a',
  },
  separator: {
    fontSize: TYPOGRAPHY.size.lg,
    color: '#CCC',
    marginBottom: 12,
  },
  presets: {
    marginBottom: SPACING.lg,
  },
  presetsLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: '#4B5563', // gray-600 for WCAG AA contrast
    marginBottom: SPACING.sm,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  presetButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  presetText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_600SemiBold',
    color: '#4B5563', // gray-600 for WCAG AA contrast
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  resetButton: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: BRAND.primary,
  },
  resetText: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    color: BRAND.primary,
  },
  applyButton: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: BRAND.primary,
  },
  applyText: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
});
