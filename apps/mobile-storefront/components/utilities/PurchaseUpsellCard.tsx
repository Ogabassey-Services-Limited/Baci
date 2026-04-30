import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '@/components/utilities/purchase-success.styles';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';

export interface PurchaseUpsellCardProps {
  colors: typeof Colors.light;
  disabled?: boolean;
  isLoading?: boolean;
  onCreateAccount: () => void;
}

export default function PurchaseUpsellCard({
  colors,
  disabled = false,
  isLoading = false,
  onCreateAccount,
}: PurchaseUpsellCardProps) {
  const isActionDisabled = disabled || isLoading;

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
        style={[
          styles.primaryButton,
          {
            backgroundColor: BRAND.primary,
            opacity: isActionDisabled ? 0.65 : 1,
          },
        ]}
        onPress={onCreateAccount}
        disabled={isActionDisabled}
        accessibilityRole="button"
        accessibilityLabel="Create account"
        accessibilityState={{
          busy: isLoading,
          disabled: isActionDisabled,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color={BRAND.onPrimary} />
        ) : null}
        <Text style={styles.primaryButtonText}>
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Text>
      </Pressable>
    </View>
  );
}
