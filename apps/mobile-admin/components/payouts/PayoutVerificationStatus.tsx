import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import type { useTheme } from '@/hooks/useTheme';
import { styles } from './payout-settings.styles';

type PayoutColors = ReturnType<typeof useTheme>['colors'];

interface PayoutVerificationStatusProps {
  accountName: string | null;
  colors: Pick<
    PayoutColors,
    'error' | 'success' | 'successLight' | 'textSecondary'
  >;
  isVerifying: boolean;
  verifyError: string | null;
}

export function PayoutVerificationStatus({
  accountName,
  colors,
  isVerifying,
  verifyError,
}: PayoutVerificationStatusProps) {
  if (isVerifying) {
    return (
      <View style={styles.verificationContainer}>
        <ActivityIndicator color={colors.textSecondary} size="small" />
        <Text
          style={[styles.verificationText, { color: colors.textSecondary }]}
        >
          Verifying account...
        </Text>
      </View>
    );
  }

  if (verifyError) {
    return (
      <View style={styles.verificationContainer}>
        <Ionicons color={colors.error} name="alert-circle" size={16} />
        <Text style={[styles.verificationText, { color: colors.error }]}>
          {verifyError}
        </Text>
      </View>
    );
  }

  if (accountName) {
    return (
      <View
        style={[
          styles.verificationContainer,
          styles.successContainer,
          { backgroundColor: colors.successLight },
        ]}
      >
        <Ionicons color={colors.success} name="checkmark-circle" size={16} />
        <Text style={[styles.verificationText, { color: colors.success }]}>
          {accountName}
        </Text>
      </View>
    );
  }

  return null;
}
