/**
 * SubmitButton Component
 *
 * 2026 Best Practices:
 * - Loading state with ActivityIndicator
 * - Full accessibility support
 * - Disabled state handling
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import type { SubmitButtonProps } from '../types';
import { styles, colors } from '../styles';

/**
 * Primary submit button with loading state
 */
export function SubmitButton({
  isLoading,
  onPress,
  label = 'Sign In & Checkout',
  loadingLabel = 'Signing in',
}: SubmitButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={isLoading ? loadingLabel : label}
      accessibilityState={{ disabled: isLoading, busy: isLoading }}
      accessibilityHint="Submit your credentials to sign in"
    >
      {isLoading ? (
        <ActivityIndicator color={colors.white} size="small" />
      ) : (
        <>
          <Ionicons
            name="person"
            size={16}
            color={colors.white}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.primaryButtonText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
