/**
 * Filter Sheet Component
 * Bottom sheet with price range filter matching web platform
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/Colors';

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
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={SlideInDown.duration(300).springify()}
              style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Filter by Price</Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </Pressable>
              </View>

              {/* Price Inputs */}
              <View style={styles.content}>
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Min Price</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currency}>₦</Text>
                      <TextInput
                        value={tempMinPrice}
                        onChangeText={setTempMinPrice}
                        keyboardType="number-pad"
                        placeholder="0"
                        style={styles.input}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>

                  <Text style={styles.separator}>-</Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Max Price</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currency}>₦</Text>
                      <TextInput
                        value={tempMaxPrice}
                        onChangeText={setTempMaxPrice}
                        keyboardType="number-pad"
                        placeholder="3000000"
                        style={styles.input}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                </View>

                {/* Quick Price Presets */}
                <View style={styles.presets}>
                  <Text style={styles.presetsLabel}>Quick Select:</Text>
                  <View style={styles.presetButtons}>
                    <Pressable
                      style={styles.presetButton}
                      onPress={() => {
                        setTempMinPrice('0');
                        setTempMaxPrice('50000');
                      }}
                    >
                      <Text style={styles.presetText}>Under ₦50k</Text>
                    </Pressable>
                    <Pressable
                      style={styles.presetButton}
                      onPress={() => {
                        setTempMinPrice('50000');
                        setTempMaxPrice('150000');
                      }}
                    >
                      <Text style={styles.presetText}>₦50k - ₦150k</Text>
                    </Pressable>
                    <Pressable
                      style={styles.presetButton}
                      onPress={() => {
                        setTempMinPrice('150000');
                        setTempMaxPrice('300000');
                      }}
                    >
                      <Text style={styles.presetText}>₦150k - ₦300k</Text>
                    </Pressable>
                    <Pressable
                      style={styles.presetButton}
                      onPress={() => {
                        setTempMinPrice('300000');
                        setTempMaxPrice('3000000');
                      }}
                    >
                      <Text style={styles.presetText}>Above ₦300k</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Pressable style={styles.resetButton} onPress={handleReset}>
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
                <Pressable style={styles.applyButton} onPress={handleApply}>
                  <Text style={styles.applyText}>Apply Filter</Text>
                </Pressable>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    width: 40,
    height: 40,
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
    color: '#666',
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
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
    marginRight: SPACING.xs,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
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
    color: '#666',
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
    backgroundColor: '#F5F5F5',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  presetText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
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
    fontSize: TYPOGRAPHY.size.md,
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
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
});
