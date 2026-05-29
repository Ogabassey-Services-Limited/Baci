import {
  getRedeemablePointBalance,
  VTU_MIN_REDEEMABLE_POINTS,
} from '@baci/shared/lib';
import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BRAND, palette } from '@/constants/Colors';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { WALLET_COLORS } from './wallet.colors';
import { styles } from './wallet.styles';
import type { WalletDisplayFundingAccount } from './wallet.types';

type WalletHeroSectionProps = {
  earningsBalance: number;
  fundingAccount: WalletDisplayFundingAccount | null;
  isCreatingFundingAccount: boolean;
  loyaltyPoints: number;
  loyaltyTier?: string | null;
  onCreateFundingAccount: () => void;
  onOpenFundPanel: () => void;
  onOpenRedeemPanel: () => void;
  savingsBalance: number;
  totalBalance: number;
};

function formatTierLabel(tier: string | null | undefined) {
  const normalizedTier = tier?.trim() || 'Bronze';
  return `${normalizedTier.charAt(0).toUpperCase()}${normalizedTier.slice(1)}`;
}

function getTierColor(tier: string) {
  switch (tier.toLowerCase()) {
    case 'gold':
      return palette.amber[500];
    case 'silver':
      return palette.gray[400];
    case 'platinum':
      return '#6366F1';
    default:
      return '#CD7F32';
  }
}

export function WalletHeroSection({
  earningsBalance,
  fundingAccount,
  isCreatingFundingAccount,
  loyaltyPoints,
  loyaltyTier,
  onCreateFundingAccount,
  onOpenFundPanel,
  onOpenRedeemPanel,
  savingsBalance,
  totalBalance,
}: WalletHeroSectionProps) {
  const { copyToClipboard, feedback: copyFeedback } = useCopyToClipboard();
  const tierLabel = formatTierLabel(loyaltyTier);
  const redeemablePoints = getRedeemablePointBalance(loyaltyPoints);
  const canRedeemPoints = loyaltyPoints >= VTU_MIN_REDEEMABLE_POINTS;

  const handleCopyFundingAccount = async () => {
    if (!fundingAccount) {
      return;
    }
    await copyToClipboard(fundingAccount.accountNumber);
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.walletHero}>
      <View style={styles.walletHeroHeader}>
        <Text style={styles.walletHeroTitle}>Wallet</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add money"
          accessibilityHint="Opens wallet funding options"
          style={styles.addMoneyButton}
          onPress={onOpenFundPanel}
        >
          <Ionicons
            accessible={false}
            importantForAccessibility="no"
            name="add-circle-outline"
            size={16}
            color={WALLET_COLORS.white}
          />
          <Text style={styles.addMoneyButtonText}>Add Money</Text>
        </Pressable>
      </View>
      <Text style={styles.balanceLabel}>Total Balance · NGN</Text>
      <Text style={styles.balanceAmount}>
        {formatNgnCurrency(totalBalance)}
      </Text>

      {fundingAccount ? (
        <>
          <View style={styles.fundingAccountPill}>
            <View style={styles.fundingAccountTextWrap}>
              <Text style={styles.fundingAccountText}>
                {`${fundingAccount.bankName} | ${fundingAccount.accountNumber}`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy funding account number"
              accessibilityHint="Copies your account number"
              style={styles.fundingAccountCopyButton}
              onPress={handleCopyFundingAccount}
            >
              <Ionicons name="copy-outline" size={16} color={BRAND.primary} />
            </Pressable>
          </View>
          {copyFeedback ? (
            <Text accessibilityRole="text" style={styles.copyFeedbackText}>
              {copyFeedback}
            </Text>
          ) : null}
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create account number"
          accessibilityHint="Creates your wallet bank transfer account"
          style={[
            styles.createAccountButton,
            isCreatingFundingAccount
              ? styles.createAccountButtonDisabled
              : null,
          ]}
          onPress={onCreateFundingAccount}
          disabled={isCreatingFundingAccount}
        >
          {isCreatingFundingAccount ? (
            <ActivityIndicator size="small" color={BRAND.primary} />
          ) : (
            <Text style={styles.createAccountButtonText}>
              Create account number
            </Text>
          )}
        </Pressable>
      )}

      <View style={styles.balanceSummaryRow}>
        <View style={styles.balanceSummaryCell}>
          <Text style={styles.balanceSummaryLabel}>Earnings</Text>
          <Text style={styles.balanceSummaryValue}>
            {formatNgnCurrency(earningsBalance)}
          </Text>
        </View>
        <View style={styles.balanceSummaryDivider} />
        <View style={styles.balanceSummaryCell}>
          <Text style={styles.balanceSummaryLabel}>Savings</Text>
          <Text style={styles.balanceSummaryValue}>
            {formatNgnCurrency(savingsBalance)}
          </Text>
        </View>
      </View>
      <View style={styles.loyaltyInlineSection}>
        <View style={styles.loyaltyInlineHeaderRow}>
          <View style={styles.loyaltyInlineCopy}>
            <Text style={styles.loyaltyInlineLabel}>Loyalty Points</Text>
            <Text style={styles.loyaltyInlineValue}>
              {loyaltyPoints.toLocaleString()} pts
            </Text>
          </View>
          <View
            style={[
              styles.loyaltyTierBadge,
              { backgroundColor: getTierColor(tierLabel) },
            ]}
          >
            <Ionicons
              accessible={false}
              importantForAccessibility="no"
              name="star"
              size={13}
              color={WALLET_COLORS.white}
            />
            <Text style={styles.loyaltyTierText}>{tierLabel}</Text>
          </View>
        </View>
        <View style={styles.loyaltyRedeemInlineRow}>
          <Text style={styles.loyaltyRedeemInlineText}>
            {`${redeemablePoints.toLocaleString()} points redeemable now`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Redeem loyalty points"
            accessibilityHint="Opens the loyalty redemption panel"
            accessibilityState={{ disabled: !canRedeemPoints }}
            disabled={!canRedeemPoints}
            onPress={onOpenRedeemPanel}
            style={({ pressed }) => [
              styles.loyaltyRedeemInlineButton,
              {
                opacity: !canRedeemPoints ? 0.5 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <Ionicons
              accessible={false}
              importantForAccessibility="no"
              name="gift-outline"
              size={15}
              color={WALLET_COLORS.white}
            />
            <Text style={styles.loyaltyRedeemInlineButtonText}>
              Redeem Points
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
