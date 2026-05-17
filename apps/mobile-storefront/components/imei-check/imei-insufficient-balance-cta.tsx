import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';

interface ImeiInsufficientBalanceCtaProps {
  balance: number;
  colors: ImeiCheckerColors;
  requiredAmount: number;
  onTopUp: (amount: number) => void;
}

export function ImeiInsufficientBalanceCta({
  balance,
  colors,
  requiredAmount,
  onTopUp,
}: ImeiInsufficientBalanceCtaProps) {
  const topUpAmount = Math.max(0, requiredAmount - balance);
  const canTopUp = topUpAmount > 0;
  const handleTopUp = () => {
    if (!canTopUp) {
      return;
    }

    onTopUp(topUpAmount);
  };

  return (
    <View
      style={[
        styles.walletCta,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.walletCtaCopy}>
        <Text style={[styles.walletCtaTitle, { color: colors.text }]}>
          Wallet balance: {formatNgnCurrency(balance)}
        </Text>
        <Text style={[styles.walletCtaText, { color: colors.textSecondary }]}>
          Top up {formatNgnCurrency(topUpAmount)} to run this IMEI lookup.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Top up wallet"
        accessibilityState={{ disabled: !canTopUp }}
        disabled={!canTopUp}
        onPress={handleTopUp}
        style={[styles.walletCtaButton, !canTopUp ? { opacity: 0.5 } : null]}
      >
        <Text style={styles.walletCtaButtonText}>Top up</Text>
        <Ionicons name="wallet-outline" size={16} color={BRAND.onPrimary} />
      </Pressable>
    </View>
  );
}
