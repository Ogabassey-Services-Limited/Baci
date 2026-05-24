import Ionicons from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import type { ErrorAlertProps } from '../types';
import { styles } from '../styles';

/**
 * Displays an error message with icon and accessibility support
 */
export function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;

  return (
    <View
      style={styles.errorContainer}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons
        name="alert-circle"
        size={16}
        color={BRAND.primary}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}
