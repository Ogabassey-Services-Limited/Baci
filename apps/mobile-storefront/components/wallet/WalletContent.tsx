import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import { WalletActionsRow } from './WalletActionsRow';
import { WalletHeroSection } from './WalletHeroSection';
import {
  type WalletTransaction,
  WalletTransactionHistory,
} from './WalletTransactionHistory';
import { WALLET_COLORS } from './wallet.colors';
import { styles } from './wallet.styles';
import type { WalletDisplayFundingAccount } from './wallet.types';

type WalletColors = (typeof Colors)['light'];

export interface WalletContentProps {
  colors: WalletColors;
  contentContainerStyle: StyleProp<ViewStyle>;
  earningsBalance: number;
  fundAmount: string;
  fundingAccount: WalletDisplayFundingAccount | null;
  isCreatingFundingAccount: boolean;
  isFundPending: boolean;
  isRedeemPending: boolean;
  isRefetching: boolean;
  loyaltyPoints: number;
  loyaltyTier?: string | null;
  onCreateFundingAccount: () => void;
  onChangeFundAmount: (value: string) => void;
  onChangeRedeemPoints: (value: string) => void;
  onConfirmFund: () => void;
  onConfirmRedeem: () => void;
  onManageCards: () => void;
  onOpenFundPanel: () => void;
  onOpenRedeemPanel: () => void;
  onQuickSave: () => void;
  onRefresh: () => void;
  onResetFund: () => void;
  onResetRedeem: () => void;
  onStartSavings: () => void;
  redeemPoints: string;
  savingsBalance: number;
  showQuickSave: boolean;
  showFundPanel: boolean;
  showRedeemPanel: boolean;
  totalBalance: number;
  transactions: WalletTransaction[];
}

export function WalletContent({
  colors,
  contentContainerStyle,
  earningsBalance,
  fundAmount,
  fundingAccount,
  isCreatingFundingAccount,
  isFundPending,
  isRedeemPending,
  isRefetching,
  loyaltyPoints,
  loyaltyTier,
  onCreateFundingAccount,
  onChangeFundAmount,
  onChangeRedeemPoints,
  onConfirmFund,
  onConfirmRedeem,
  onManageCards,
  onOpenFundPanel,
  onOpenRedeemPanel,
  onQuickSave,
  onRefresh,
  onResetFund,
  onResetRedeem,
  onStartSavings,
  redeemPoints,
  savingsBalance,
  showQuickSave,
  showFundPanel,
  showRedeemPanel,
  totalBalance,
  transactions,
}: WalletContentProps) {
  return (
    <ScrollView
      testID="wallet-scroll"
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={BRAND.primary}
        />
      }
    >
      <WalletHeroSection
        earningsBalance={earningsBalance}
        fundingAccount={fundingAccount}
        isCreatingFundingAccount={isCreatingFundingAccount}
        loyaltyPoints={loyaltyPoints}
        loyaltyTier={loyaltyTier}
        onCreateFundingAccount={onCreateFundingAccount}
        onOpenFundPanel={onOpenFundPanel}
        onOpenRedeemPanel={onOpenRedeemPanel}
        savingsBalance={savingsBalance}
        totalBalance={totalBalance}
      />

      <WalletActionsRow
        colors={colors}
        onManageCards={onManageCards}
        onQuickSave={onQuickSave}
        onStartSavings={onStartSavings}
        showQuickSave={showQuickSave}
      />

      {showFundPanel ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.redeemPanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.redeemPanelTitle, { color: colors.text }]}>
            Add Funds
          </Text>
          <Text
            style={[
              styles.redeemPanelSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Enter the amount you want to add to your wallet.
          </Text>

          <TextInput
            accessibilityLabel="Wallet top-up amount"
            style={[
              styles.redeemInput,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={fundAmount}
            onChangeText={onChangeFundAmount}
            keyboardType="number-pad"
            placeholder="Enter amount (min ₦100)"
            placeholderTextColor={colors.placeholder}
          />

          <View style={styles.redeemPanelActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel wallet top-up"
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onResetFund}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm wallet top-up"
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: BRAND.primary,
                  opacity: isFundPending ? 0.5 : 1,
                },
              ]}
              onPress={onConfirmFund}
              disabled={isFundPending}
            >
              {isFundPending ? (
                <ActivityIndicator size="small" color={WALLET_COLORS.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Continue</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {showRedeemPanel ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.redeemPanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.redeemPanelTitle, { color: colors.text }]}>
            Redeem Loyalty Points
          </Text>
          <Text
            style={[
              styles.redeemPanelSubtitle,
              { color: colors.textSecondary, marginBottom: SPACING.md },
            ]}
          >
            Available: {loyaltyPoints.toLocaleString()} points
          </Text>

          {/* Points Conversion & Super Quiz Benefits Info Card */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                marginBottom: SPACING.md,
              },
            ]}
          >
            <Text style={[styles.infoCardTitle, { color: colors.text }]}>
              ✨ Loyalty Points Benefits
            </Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoEmoji}>💵</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>
                  Convert to Cash:
                </Text>{' '}
                100 points = ₦10. Redeem blocks of 100 points directly into your
                wallet.
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoEmoji}>🏆</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>
                  Super Quiz Entry:
                </Text>{' '}
                Use points as exam passes to join high-stake quiz events and win
                huge prizes!
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoEmoji}>⚡</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>
                  Leaderboard Tie-Breaker:
                </Text>{' '}
                If tied, players with higher loyalty points rank higher on the
                leaderboard!
              </Text>
            </View>

            <Text
              style={[
                styles.infoSubTitle,
                { color: colors.text, marginTop: SPACING.xs },
              ]}
            >
              Tier Rankings:
            </Text>
            <View style={styles.tierRow}>
              <Text style={[styles.tierBadge, { backgroundColor: '#7C2D12' }]}>
                BRONZE
              </Text>
              <Text style={[styles.tierBadge, { backgroundColor: '#4B5563' }]}>
                SILVER
              </Text>
              <Text style={[styles.tierBadge, { backgroundColor: '#D97706' }]}>
                GOLD
              </Text>
              <Text style={[styles.tierBadge, { backgroundColor: '#4F46E5' }]}>
                PLATINUM
              </Text>
            </View>
          </View>

          <TextInput
            accessibilityLabel="Points to redeem"
            style={[
              styles.redeemInput,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={redeemPoints}
            onChangeText={onChangeRedeemPoints}
            keyboardType="number-pad"
            placeholder={`Enter points to redeem (min ${VTU_MIN_REDEEMABLE_POINTS})`}
            placeholderTextColor={colors.placeholder}
          />

          <View style={styles.redeemPanelActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel redeem points"
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onResetRedeem}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm redeem points"
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: BRAND.primary,
                  opacity: isRedeemPending ? 0.5 : 1,
                },
              ]}
              onPress={onConfirmRedeem}
              disabled={isRedeemPending}
            >
              {isRedeemPending ? (
                <ActivityIndicator size="small" color={WALLET_COLORS.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Redeem</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      <WalletTransactionHistory colors={colors} transactions={transactions} />
    </ScrollView>
  );
}
