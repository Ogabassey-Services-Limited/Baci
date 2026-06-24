import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';

type NegotiationOfferFormProps = {
  offer: string;
  onOfferChange: (value: string) => void;
  onSubmitPress: () => void;
};

// Group whole-naira digits with thousands separators for display, e.g.
// "194000" -> "194,000". The stored `offer` stays raw digits so the
// validator/submit paths keep parsing cleanly.
function formatOfferAmount(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) {
    return '';
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function NegotiationOfferForm({
  offer,
  onOfferChange,
  onSubmitPress,
}: NegotiationOfferFormProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>
        Your offer
      </Text>
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
          ₦
        </Text>
        <TextInput
          style={[styles.priceInput, { color: colors.text }]}
          value={formatOfferAmount(offer)}
          onChangeText={(text) => onOfferChange(text.replace(/[^0-9]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          accessibilityLabel="Your offer amount in naira"
        />
      </View>
      <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
        Enter what you'd like to pay — we'll see what we can do.
      </Text>
      <Pressable
        style={[styles.submitButton, { backgroundColor: colors.primary }]}
        onPress={onSubmitPress}
        accessibilityLabel="Submit your offer"
        accessibilityRole="button"
      >
        <Text
          style={[styles.submitButtonText, { color: colors.primaryForeground }]}
        >
          Submit Offer
        </Text>
      </Pressable>
    </Animated.View>
  );
}
