import { router } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BRAND } from '@/constants/Colors';
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
      return WALLET_COLORS.loyaltyTierGoldBackground;
    case 'silver':
      return WALLET_COLORS.loyaltyTierSilverBackground;
    case 'platinum':
      return WALLET_COLORS.loyaltyTierPlatinumBackground;
    default:
      return WALLET_COLORS.loyaltyTierBronzeBackground;
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

  const handleCopyFundingAccount = async () => {
    if (!fundingAccount) {
      return;
    }
    await copyToClipboard(fundingAccount.accountNumber);
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.walletHero}>
      <View style={styles.walletHeroHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.walletHeroTitle}>Wallet</Text>
          <View
            style={[
              styles.loyaltyTierBadgeCompact,
              {
                backgroundColor: getTierColor(formatTierLabel(loyaltyTier)),
                marginTop: 0,
                paddingHorizontal: 8,
                paddingVertical: 3,
                gap: 4,
              },
            ]}
          >
            <Ionicons
              accessible={false}
              importantForAccessibility="no"
              name="star"
              size={9}
              color={WALLET_COLORS.loyaltyTierText}
            />
            <Text style={[styles.loyaltyTierTextCompact, { fontSize: 9 }]}>
              {formatTierLabel(loyaltyTier)}
            </Text>
          </View>
        </View>
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
          <Text
            style={styles.balanceSummaryValue}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.5}
          >
            {formatNgnCurrency(earningsBalance)}
          </Text>
        </View>
        <View style={styles.balanceSummaryDivider} />
        <View style={styles.balanceSummaryCell}>
          <Text style={styles.balanceSummaryLabel}>Savings</Text>
          <Text
            style={styles.balanceSummaryValue}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.5}
          >
            {formatNgnCurrency(savingsBalance)}
          </Text>
        </View>
        <View style={styles.balanceSummaryDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Redeem loyalty points"
          accessibilityHint="Opens the loyalty redemption panel"
          style={styles.balanceSummaryCell}
          onPress={onOpenRedeemPanel}
        >
          <Text style={styles.balanceSummaryLabel}>Loyalty</Text>
          <Text
            style={styles.balanceSummaryValue}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.5}
          >
            {loyaltyPoints.toLocaleString()} pts
          </Text>
          <View
            style={[
              styles.loyaltyTierBadgeCompact,
              { backgroundColor: BRAND.primary },
            ]}
          >
            <Ionicons
              accessible={false}
              importantForAccessibility="no"
              name="gift-outline"
              size={9}
              color={WALLET_COLORS.loyaltyTierText}
            />
            <Text style={styles.loyaltyTierTextCompact}>REDEEM</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.utilityPillsDivider} />
      <Text style={styles.utilityPillsLabel}>Quick Utilities</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.utilityPillsScroll}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buy Airtime"
          style={styles.utilityPill}
          onPress={() => router.push('/utilities/airtime')}
        >
          <Ionicons name="call-outline" size={14} color={WALLET_COLORS.white} />
          <Text style={styles.utilityPillText}>Airtime</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buy Data"
          style={styles.utilityPill}
          onPress={() => router.push('/utilities/data')}
        >
          <Ionicons name="wifi" size={14} color={WALLET_COLORS.white} />
          <Text style={styles.utilityPillText}>Data</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pay Power Bill"
          style={styles.utilityPill}
          onPress={() => router.push('/utilities/power')}
        >
          <Ionicons name="flash-outline" size={14} color={WALLET_COLORS.white} />
          <Text style={styles.utilityPillText}>Power</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pay TV Bill"
          style={styles.utilityPill}
          onPress={() => router.push('/utilities/tv')}
        >
          <Ionicons name="tv-outline" size={14} color={WALLET_COLORS.white} />
          <Text style={styles.utilityPillText}>Cable TV</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pay Gaming Bill"
          style={styles.utilityPill}
          onPress={() => router.push('/utilities/gaming')}
        >
          <Ionicons name="game-controller-outline" size={14} color={WALLET_COLORS.white} />
          <Text style={styles.utilityPillText}>Gaming</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}
