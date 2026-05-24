import Ionicons from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles, colors } from '../styles';

interface CreateAccountCardProps {
  onPress: () => void;
}

export function CreateAccountCard({ onPress }: CreateAccountCardProps) {
  return (
    <View
      style={[styles.optionCard, styles.optionCardSecondary]}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Create account option"
    >
      <View style={[styles.optionHeader, styles.optionHeaderCentered]}>
        <Ionicons
          name="person-add"
          size={16}
          color={colors.primary}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text style={styles.optionTitle} accessibilityRole="header">
          Create Account
        </Text>
      </View>
      <Text
        style={[styles.optionDescription, styles.optionDescriptionCentered]}
      >
        Save your details for faster checkout next time.
      </Text>
      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 12 }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Register now"
        accessibilityHint="Navigate to registration page"
      >
        <Text style={styles.secondaryButtonText}>Register Now</Text>
      </TouchableOpacity>
    </View>
  );
}
