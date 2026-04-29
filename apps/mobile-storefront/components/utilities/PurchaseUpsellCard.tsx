import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { styles } from './purchase-success.styles';

interface PurchaseUpsellCardProps {
  colors: typeof Colors.light;
  onCreateAccount: () => void;
}

export default function PurchaseUpsellCard({
  colors,
  onCreateAccount,
}: PurchaseUpsellCardProps) {
  return (
    <View
      style={[
        styles.upsellCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.upsellTitle, { color: colors.text }]}>
        Save this beneficiary?
      </Text>
      <Text style={[styles.upsellText, { color: colors.textSecondary }]}>
        Create an account to save this number, view transaction history, and
        earn loyalty points!
      </Text>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
        onPress={onCreateAccount}
        accessibilityRole="button"
        accessibilityLabel="Create account"
      >
        <Text style={styles.primaryButtonText}>Create Account</Text>
      </Pressable>
    </View>
  );
}
