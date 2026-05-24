import Ionicons from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';
import { colors, styles } from '../styles';
import type { SubmitButtonProps } from '../types';

/**
 * Primary submit button with loading state
 */
export function SubmitButton({
  isLoading,
  onPress,
  label = 'Sign In & Checkout',
  loadingLabel = 'Signing in',
}: SubmitButtonProps) {
  const haptics = useHaptics();

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
      onPress={handlePress}
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
