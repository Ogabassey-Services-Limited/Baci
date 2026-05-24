import Ionicons from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles, colors } from '../styles';

interface GuestCheckoutCardProps {
  onPress: () => void;
}

export function GuestCheckoutCard({ onPress }: GuestCheckoutCardProps) {
  return (
    <View
      style={styles.optionCard}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Guest checkout option"
    >
      <View style={styles.optionHeader}>
        <Ionicons
          name="flash"
          size={16}
          color={colors.amber}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text style={styles.optionTitle} accessibilityRole="header">
          Guest Checkout
        </Text>
      </View>
      <Text style={styles.optionDescription}>
        Fastest way to checkout. Create an account later if you wish.
      </Text>
      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 12 }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Continue as guest"
        accessibilityHint="Proceed to checkout without creating an account"
      >
        <Text style={styles.primaryButtonText}>Continue as Guest</Text>
      </TouchableOpacity>
    </View>
  );
}
