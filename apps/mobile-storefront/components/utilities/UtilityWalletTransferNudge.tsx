import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';

type WalletColors = (typeof Colors)['light'];

const WALLET_FUNDING_NUDGE =
  'Pay from your wallet to skip card fees — transfers to your wallet account number cost 1%, capped at ₦300.';
const WALLET_FUNDING_CTA = 'Pay with Bank Transfer';

interface UtilityWalletTransferNudgeProps {
  amount: number;
  /**
   * True only when the customer is signed in AND the merchant has wallet
   * DVAs enabled. Gates the nudge so we never advertise a bank-transfer
   * funding path that routes to a DVA_DISABLED / login dead end.
   */
  canFundByBankTransfer: boolean;
  colors: WalletColors;
  hasWalletToggle: boolean;
  walletBalance?: number;
  walletError?: Error | null;
  walletIsLoading?: boolean;
}

export function UtilityWalletTransferNudge({
  amount,
  canFundByBankTransfer,
  colors,
  hasWalletToggle,
  walletBalance,
  walletError,
  walletIsLoading,
}: UtilityWalletTransferNudgeProps) {
  const visible =
    canFundByBankTransfer &&
    hasWalletToggle &&
    walletIsLoading !== true &&
    !walletError &&
    amount > 0 &&
    (walletBalance ?? 0) < amount;

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[
        styles.walletNudge,
        {
          backgroundColor: `${BRAND.primary}10`,
          borderColor: `${BRAND.primary}30`,
        },
      ]}
    >
      <Text style={[styles.walletNudgeText, { color: colors.text }]}>
        {WALLET_FUNDING_NUDGE}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={WALLET_FUNDING_CTA}
        onPress={() =>
          router.push({
            pathname: '/wallet',
            params: { action: 'bank-transfer' },
          })
        }
      >
        <Text style={styles.walletNudgeCta}>{WALLET_FUNDING_CTA}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  walletNudge: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  walletNudgeCta: {
    color: BRAND.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  walletNudgeText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
