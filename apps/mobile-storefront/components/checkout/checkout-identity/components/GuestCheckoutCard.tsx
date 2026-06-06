import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';

interface GuestCheckoutCardProps {
  onPress: () => void;
  theme: CheckoutIdentityTheme;
}

export function GuestCheckoutCard({ onPress, theme }: GuestCheckoutCardProps) {
  return (
    <View
      style={[
        styles.optionCard,
        styles.guestPassiveCard,
        { backgroundColor: theme.input, borderColor: theme.border },
      ]}
      accessible={false}
      accessibilityRole="none"
      accessibilityLabel="Guest checkout option"
    >
      <View style={[styles.optionHeader, styles.optionHeaderCentered]}>
        <Ionicons
          name="flash"
          size={16}
          color={theme.accent}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text
          style={[styles.optionTitle, { color: theme.text }]}
          accessibilityRole="header"
        >
          Guest Checkout
        </Text>
      </View>
      <Text
        style={[
          styles.optionDescription,
          styles.optionDescriptionCentered,
          { color: theme.mutedText },
        ]}
      >
        Fastest way to checkout. Create an account later if you wish.
      </Text>
      <TouchableOpacity
        style={[
          styles.passiveButton,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Continue as guest"
        accessibilityHint="Proceed to checkout without creating an account"
      >
        <Text style={[styles.passiveButtonText, { color: theme.text }]}>
          Continue as Guest
        </Text>
      </TouchableOpacity>
    </View>
  );
}
