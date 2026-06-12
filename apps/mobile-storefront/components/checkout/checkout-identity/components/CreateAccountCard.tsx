import Ionicons from '@react-native-vector-icons/ionicons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';

interface CreateAccountCardProps {
  onPress: () => void;
  theme: CheckoutIdentityTheme;
}

export function CreateAccountCard({ onPress, theme }: CreateAccountCardProps) {
  return (
    <View
      style={[
        styles.optionCard,
        styles.optionCardSecondary,
        {
          backgroundColor: theme.cardSecondary,
          borderColor: theme.primarySubtle,
        },
      ]}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Create account option"
    >
      <View style={[styles.optionHeader, styles.optionHeaderCentered]}>
        <Ionicons
          name="person-add"
          size={16}
          color={theme.primary}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text
          style={[styles.optionTitle, { color: theme.text }]}
          accessibilityRole="header"
        >
          Create Account
        </Text>
      </View>
      <Text
        style={[
          styles.optionDescription,
          styles.optionDescriptionCentered,
          { color: theme.mutedText },
        ]}
      >
        Save your details for faster checkout next time.
      </Text>
      <TouchableOpacity
        style={[
          styles.secondaryButton,
          {
            backgroundColor: theme.cardSecondary,
            borderColor: theme.primary,
            marginTop: 12,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Register now"
        accessibilityHint="Navigate to registration page"
      >
        <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
          Register Now
        </Text>
      </TouchableOpacity>
    </View>
  );
}
